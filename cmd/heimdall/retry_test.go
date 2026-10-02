package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"heimdall/internal/model"
	"heimdall/internal/plan"
)

func retryPlan(ids ...string) *plan.Plan {
	students := make([]plan.StudentPlan, 0, len(ids))
	for _, id := range ids {
		students = append(students, plan.StudentPlan{
			ID: id, Name: id,
			Checks: []plan.ResolvedCheck{
				{ID: "c1", Weight: 1}, {ID: "c2", Weight: 2},
			},
		})
	}
	return &plan.Plan{
		Hash:     "hash-del-plan",
		Students: students,
		Summary: model.PlanSummary{
			CheckCount: 2, TotalWeight: 3, CheckIDs: []string{"c1", "c2"},
		},
	}
}

// artifactOf writes a previous run where each student's checks have the given
// statuses, in the order c1, c2.
func artifactOf(hash string, byStudent map[string][2]model.AcademicStatus) *model.RunResult {
	run := &model.RunResult{
		SchemaVersion: model.SchemaVersion,
		RunID:         "R1",
		PlanHash:      hash,
		FinishedAt:    time.Now(),
	}
	for id, statuses := range byStudent {
		s := model.StudentResult{StudentID: id, Name: id}
		for i, status := range statuses {
			cause := model.CauseNone
			if status == model.Unevaluated {
				cause = model.CauseConnectFailed
			}
			s.Checks = append(s.Checks, model.CheckResult{
				CheckID: []string{"c1", "c2"}[i], Status: status, Cause: cause,
			})
		}
		run.Students = append(run.Students, s)
	}
	return run
}

// A previous run made with another exam or another classroom cannot be
// repeated over this PLAN: it would move somebody's denominator (ADR-0018 §4).
func TestRetryRefusesAPlanThatIsNotTheSameOne(t *testing.T) {
	p := retryPlan("alu1")
	before := artifactOf("otro-hash", map[string][2]model.AcademicStatus{
		"alu1": {model.Pass, model.Unevaluated},
	})
	_, err := planRetry(p, before, "var/run-R1.json")
	if err == nil {
		t.Fatal("un PLAN distinto tiene que ser un error de configuración")
	}
	if !strings.Contains(err.Error(), "denominador") {
		t.Errorf("el mensaje tiene que decir por qué, y dice: %s", err)
	}
}

// Nothing to repeat is an error and not an empty run: a run of nobody would
// write an artifact that says a class was evaluated when it was not.
func TestRetryRefusesARunWithNothingUnevaluated(t *testing.T) {
	p := retryPlan("alu1")
	before := artifactOf("hash-del-plan", map[string][2]model.AcademicStatus{
		"alu1": {model.Pass, model.Fail},
	})
	if _, err := planRetry(p, before, "var/run-R1.json"); err == nil {
		t.Fatal("sin nada sin evaluar no hay nada que repetir")
	}
}

// Only the students with something left are evaluated again, and the PLAN's
// numbers are untouched.
func TestRetryKeepsOnlyTheStudentsWithSomethingLeft(t *testing.T) {
	p := retryPlan("alu1", "alu2", "alu3")
	before := artifactOf("hash-del-plan", map[string][2]model.AcademicStatus{
		"alu1": {model.Pass, model.Fail},               // terminado
		"alu2": {model.Unevaluated, model.Fail},        // le falta una
		"alu3": {model.Unevaluated, model.Unevaluated}, // no se pudo mirar
	})

	retry, err := planRetry(p, before, "var/run-R1.json")
	if err != nil {
		t.Fatalf("no se pudo preparar el reintento: %s", err)
	}

	var kept []string
	for _, sp := range p.Students {
		kept = append(kept, sp.ID)
	}
	if strings.Join(kept, ",") != "alu2,alu3" {
		t.Errorf("se repite a quien tiene algo sin evaluar: alu2,alu3, y quedan %v", kept)
	}
	if retry.Ref.Students != 2 || retry.Ref.Checks != 3 {
		t.Errorf("el reintento es de 2 alumnos y 3 comprobaciones, y dice %d y %d",
			retry.Ref.Students, retry.Ref.Checks)
	}
	if retry.Ref.RunID != "R1" || retry.Ref.Artifact != "var/run-R1.json" {
		t.Errorf("el reintento tiene que decir de qué ejecución viene: %+v", retry.Ref)
	}
	if p.Summary.TotalWeight != 3 || p.Summary.CheckCount != 2 {
		t.Errorf("el reintento no toca el PLAN, y ha quedado %+v", p.Summary)
	}
}

// Only UNEVALUATED is repeated. This is the rule that keeps a retry from
// becoming a second chance at a fail.
func TestRetryRepeatsOnlyUnevaluated(t *testing.T) {
	p := retryPlan("alu1")
	before := artifactOf("hash-del-plan", map[string][2]model.AcademicStatus{
		"alu1": {model.Fail, model.Unevaluated},
	})
	retry, err := planRetry(p, before, "var/run-R1.json")
	if err != nil {
		t.Fatalf("no se pudo preparar el reintento: %s", err)
	}
	if retry.Repeat("alu1", "c1") {
		t.Error("un FAIL no se repite nunca de forma automática")
	}
	if !retry.Repeat("alu1", "c2") {
		t.Error("lo que quedó sin evaluar es justo lo que se repite")
	}
	if retry.Repeat("alu1", "no-existe") {
		t.Error("una comprobación que aquella ejecución no reportó no se repite")
	}
}

// An artifact written in a schema this engine does not know is refused, not
// guessed: a field that changed meaning would be read as a result that is not
// there.
func TestReadArtifactRefusesAnUnknownSchema(t *testing.T) {
	path := filepath.Join(t.TempDir(), "run-R1.json")
	if err := os.WriteFile(path, []byte(`{"schema_version":99,"run_id":"R1"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := readArtifact(path); err == nil || !strings.Contains(err.Error(), "99") {
		t.Fatalf("un esquema desconocido se rechaza diciendo cuál es; err = %v", err)
	}
}

// A previous artifact that is not there ends the run before any machine is
// touched, with exit 2 and an untouched var/.
func TestRunRejectsARetryWhosePreviousRunIsMissing(t *testing.T) {
	out := t.TempDir()
	var stdout, stderr bytes.Buffer
	got := run([]string{"run", "--retry=" + filepath.Join(out, "no-existe.json"),
		"--secrets=env", "--var=" + out, protoProject}, &stdout, &stderr)
	if got != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d", got, exitInvalidConfig)
	}
	if !strings.Contains(stderr.String(), "no-existe.json") {
		t.Errorf("el motor tiene que decir qué fichero no ha podido leer: %s", stderr.String())
	}
	assertEmptyDir(t, out)
}

func TestReadArtifactRejectsUnsupportedGrades(t *testing.T) {
	for _, mutate := range []func(*model.RunResult){
		func(r *model.RunResult) { r.Students[0].Checks = nil },
		func(r *model.RunResult) { r.Students[0].Checks[0].Weight = 2 },
		func(r *model.RunResult) { r.Students[0].Checks[0].CheckID = "unknown" },
		func(r *model.RunResult) { r.Students[0].Score.Final = new(int) },
		func(r *model.RunResult) { r.Students[0].Checks[0].Execution = nil },
		func(r *model.RunResult) { r.Students[0].Checks[0].Cause = model.CauseTimeout },
	} {
		r := sessionRun("R1", 15, "fake", model.Pass, model.Pass)
		mutate(r)
		path := writeRun(t, t.TempDir(), "run.json", r)
		if _, err := readArtifact(path); err == nil {
			t.Fatal("corrupted artifact accepted")
		}
	}
	r := sessionRun("R1", 15, "fake", model.Pass, model.Pass)
	data, _ := model.MarshalCanonical(r)
	data = bytes.Replace(data, []byte(`"weight": 6`), []byte(`"weight": null`), 1)
	path := filepath.Join(t.TempDir(), "null-weight.json")
	os.WriteFile(path, data, 0600)
	if _, err := readArtifact(path); err == nil {
		t.Fatal("null weight accepted")
	}
	r.Warnings = []model.Warning{{Code: "RESTORED_FROM_BACKUP"}}
	for i := range r.Students[0].Checks {
		r.Students[0].Checks[i].Execution = nil
		r.Students[0].Checks[i].Assertion = nil
	}
	path = writeRun(t, t.TempDir(), "backup.json", r)
	if _, err := readArtifact(path); err != nil {
		t.Fatalf("valid backup refused: %v", err)
	}
}
