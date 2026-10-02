package main

// `--retry` repeats what an earlier run could not evaluate, and only that
// (ADR-0018). Everything in here happens before the first connection: if the
// previous artifact does not belong to this PLAN, the run ends with exit 2
// and no machine is touched (ADR-0002).

import (
	"encoding/json"
	"fmt"
	"os"

	"heimdall/internal/engine"
	"heimdall/internal/model"
	"heimdall/internal/plan"
)

// readArtifact loads a finished artifact from disk. It refuses a schema it
// does not know instead of guessing: a field that changed meaning would be
// read as a result that is not there.
func readArtifact(path string) (*model.RunResult, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("no se pudo leer la corrección anterior de %s: %w", path, err)
	}
	var run model.RunResult
	if err := json.Unmarshal(data, &run); err != nil {
		return nil, fmt.Errorf("%s no es un resultado de Heimdall: %s", path, err)
	}
	if run.SchemaVersion != model.SchemaVersion {
		return nil, fmt.Errorf(
			"%s está escrito en la versión %d del formato y este motor entiende la %d",
			path, run.SchemaVersion, model.SchemaVersion)
	}
	if run.RunID == "" {
		return nil, fmt.Errorf("%s no dice de qué ejecución es", path)
	}
	if err := model.ValidateArtifactJSON(data); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	if err := model.ValidateArtifact(&run); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return &run, nil
}

// planRetry builds the selection of a repeat run and trims the PLAN to the
// students that have something to repeat.
//
// It does not touch check_ids, weights or total_weight: they are the PLAN's
// and they are the same for everybody, which is the whole point of fixing the
// denominator before the run (ADR-0004). What it changes is only *who* is
// evaluated and *which* of their checks are executed again.
func planRetry(p *plan.Plan, previous *model.RunResult, path string) (*engine.Retry, error) {
	if previous.PlanHash != p.Hash {
		return nil, fmt.Errorf(
			"la corrección de %s se hizo con otro examen o con otra aula; "+
				"no se puede repetir sobre este PLAN sin cambiarle el denominador a la clase", path)
	}

	// Read every ancestor before selecting work. NOT_RUN in a retry does not
	// erase a PASS/FAIL in an older artifact.
	chain := []model.ChainLink{{Artifact: path, Run: previous}}
	if previous.RetryOf != nil {
		var err error
		chain, err = readChain(path)
		if err != nil {
			return nil, err
		}
	}
	if len(chain) >= maxChain {
		return nil, fmt.Errorf("la cadena ya tiene %d correcciones; otro reintento superaría el límite recuperable", maxChain)
	}
	effective, err := model.Consolidate(chain)
	if err != nil {
		return nil, err
	}
	byStudent := map[string]map[string]model.PreviousAttempt{}
	selected := 0
	for _, s := range effective.Students {
		checks := map[string]model.PreviousAttempt{}
		for _, c := range s.Checks {
			checks[c.CheckID] = model.PreviousAttempt{
				RunID: c.FromRun, Status: c.Status, Cause: c.Cause,
				Detail: c.Detail, FinishedAt: c.FromRunAt,
			}
			if c.Status == model.Unevaluated {
				selected++
			}
		}
		byStudent[s.StudentID] = checks
	}
	if selected == 0 {
		return nil, fmt.Errorf(
			"en la corrección de %s no quedó ninguna comprobación sin evaluar: no hay nada que repetir", path)
	}

	retry := &engine.Retry{Previous: byStudent}

	kept := make([]plan.StudentPlan, 0, len(p.Students))
	for _, sp := range p.Students {
		if hasUnevaluated(retry, sp) {
			kept = append(kept, sp)
		}
	}
	if len(kept) == 0 {
		return nil, fmt.Errorf(
			"ninguno de los alumnos de este aula aparece con comprobaciones sin evaluar en %s", path)
	}
	p.Students = kept

	retry.Ref = model.RetryRef{
		RunID:    previous.RunID,
		Artifact: path,
		RunAt:    previous.FinishedAt,
		Students: len(kept),
		Checks:   countRepeats(retry, kept),
	}
	return retry, nil
}

// hasUnevaluated reports whether this student has anything left to repeat.
// A student who finished is not evaluated again: their checks already have a
// result and repeating them would hand them attempts nobody else got.
func hasUnevaluated(retry *engine.Retry, sp plan.StudentPlan) bool {
	if sp.Excluded {
		return false
	}
	for _, c := range sp.Checks {
		if retry.Repeat(sp.ID, c.ID) {
			return true
		}
	}
	return false
}

// countRepeats is how many checks this run will actually execute, so the
// artifact and the GUI can say it before it starts.
func countRepeats(retry *engine.Retry, students []plan.StudentPlan) int {
	n := 0
	for _, sp := range students {
		for _, c := range sp.Checks {
			if retry.Repeat(sp.ID, c.ID) {
				n++
			}
		}
	}
	return n
}
