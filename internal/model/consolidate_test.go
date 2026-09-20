package model

import (
	"strings"
	"testing"
	"time"
)

// The chain of the real classroom case: on Tuesday the machine of alumne02
// was off, on Wednesday it was on. Nobody else is corrected again.

func at(day int) time.Time {
	return time.Date(2026, 9, day, 10, 0, 0, 0, time.UTC)
}

func chainPlan() PlanSummary {
	return PlanSummary{CheckCount: 2, TotalWeight: 10, CheckIDs: []string{"C-1", "C-2"}}
}

func chainCheck(id string, weight float64, status AcademicStatus, cause Cause) CheckResult {
	return CheckResult{CheckID: id, Group: "red", Description: id, Weight: weight, Status: status, Cause: cause}
}

func chainStudent(id string, day int, checks ...CheckResult) StudentResult {
	graded := make([]CheckResult, len(checks))
	copy(graded, checks)
	return StudentResult{
		StudentID:  id,
		Name:       id,
		Status:     StudentStatusOf(graded),
		StartedAt:  at(day),
		FinishedAt: at(day),
		Score:      ComputeScore(chainPlan(), graded),
		Checks:     checks,
	}
}

func chainRun(id string, day int, students ...StudentResult) *RunResult {
	return &RunResult{
		SchemaVersion: SchemaVersion,
		RunID:         id,
		StartedAt:     at(day),
		FinishedAt:    at(day),
		Status:        RunStatusOf(students),
		PlanHash:      "hash-del-plan",
		Plan:          chainPlan(),
		Students:      students,
	}
}

// tuesday: alumne01 finished, alumne02 could not be reached at all.
func tuesday() *RunResult {
	return chainRun("RUN-MARTES", 15,
		chainStudent("alumne01", 15,
			chainCheck("C-1", 6, Pass, CauseNone),
			chainCheck("C-2", 4, Fail, CauseNone)),
		chainStudent("alumne02", 15,
			chainCheck("C-1", 6, Unevaluated, CauseConnectFailed),
			chainCheck("C-2", 4, Unevaluated, CauseConnectFailed)),
	)
}

// wednesday repeats only alumne02, and only what was unevaluated.
func wednesday() *RunResult {
	run := chainRun("RUN-MIERCOLES", 16,
		chainStudent("alumne02", 16,
			chainCheck("C-1", 6, Pass, CauseNone),
			chainCheck("C-2", 4, Pass, CauseNone)),
	)
	run.RetryOf = &RetryRef{RunID: "RUN-MARTES", Artifact: "var/run-martes.json", RunAt: at(15), Students: 1, Checks: 2}
	return run
}

func chainOf(runs ...*RunResult) []ChainLink {
	chain := make([]ChainLink, 0, len(runs))
	for _, run := range runs {
		chain = append(chain, ChainLink{Artifact: "var/" + run.RunID + ".json", Run: run})
	}
	return chain
}

func studentOf(t *testing.T, c *Consolidation, id string) ConsolidatedStudent {
	t.Helper()
	for _, s := range c.Students {
		if s.StudentID == id {
			return s
		}
	}
	t.Fatalf("el alumno %s no aparece en la consolidación", id)
	return ConsolidatedStudent{}
}

// TestConsolidateClosesTheStudentWhoFinishedLater is the case the whole task
// exists for: nobody is graded twice, and the student who was finished on
// Wednesday gets a final grade the Wednesday artifact cannot give by itself.
func TestConsolidateClosesTheStudentWhoFinishedLater(t *testing.T) {
	got, err := Consolidate(chainOf(wednesday(), tuesday()))
	if err != nil {
		t.Fatalf("Consolidate: %v", err)
	}

	two := studentOf(t, got, "alumne02")
	if two.Status != StudentOK {
		t.Errorf("estado de alumne02 = %q, want OK", two.Status)
	}
	if two.Score.Final == nil || *two.Score.Final != 100 {
		t.Fatalf("final_score de alumne02 = %v, want 100", two.Score.Final)
	}
	if two.Score.Total != 10 || two.Score.Unevaluated != 0 {
		t.Errorf("denominador = %v con %v sin evaluar, want 10 y 0", two.Score.Total, two.Score.Unevaluated)
	}

	// And every result says where it comes from, with the failed attempt kept.
	for _, c := range two.Checks {
		if c.FromRun != "RUN-MIERCOLES" {
			t.Errorf("%s sale de %q, want RUN-MIERCOLES", c.CheckID, c.FromRun)
		}
		if len(c.Attempts) != 1 || c.Attempts[0].RunID != "RUN-MARTES" {
			t.Errorf("%s no conserva el intento del martes: %+v", c.CheckID, c.Attempts)
		}
		if c.Attempts[0].Cause != CauseConnectFailed {
			t.Errorf("%s: el intento anterior pierde su causa: %q", c.CheckID, c.Attempts[0].Cause)
		}
	}

	// The student who was already finished is not re-graded, and says so.
	one := studentOf(t, got, "alumne01")
	if one.Score.Final == nil || *one.Score.Final != 60 {
		t.Fatalf("final_score de alumne01 = %v, want 60", one.Score.Final)
	}
	for _, c := range one.Checks {
		if c.FromRun != "RUN-MARTES" || len(c.Attempts) != 0 {
			t.Errorf("%s de alumne01 sale de %q con %d intentos previos, want RUN-MARTES y 0",
				c.CheckID, c.FromRun, len(c.Attempts))
		}
	}
}

// TestConsolidateKeepsTheClassInOrder: the oldest run is the one with the
// whole class; a retry only carries who had something left.
func TestConsolidateKeepsTheClassInOrder(t *testing.T) {
	got, err := Consolidate(chainOf(wednesday(), tuesday()))
	if err != nil {
		t.Fatalf("Consolidate: %v", err)
	}
	if len(got.Students) != 2 {
		t.Fatalf("alumnos = %d, want 2: el reintento no puede perder a nadie", len(got.Students))
	}
	if got.Students[0].StudentID != "alumne01" || got.Students[1].StudentID != "alumne02" {
		t.Errorf("orden = %s, %s; want alumne01, alumne02",
			got.Students[0].StudentID, got.Students[1].StudentID)
	}
	if len(got.Runs) != 2 || got.Runs[0].RunID != "RUN-MIERCOLES" {
		t.Errorf("la cadena no va de la más reciente a la más antigua: %+v", got.Runs)
	}
}

// TestConsolidateWithSomethingStillMissing: rule 1 of the grading policy does
// not bend because two runs are read at once.
func TestConsolidateWithSomethingStillMissing(t *testing.T) {
	half := chainRun("RUN-MIERCOLES", 16,
		chainStudent("alumne02", 16,
			chainCheck("C-1", 6, Pass, CauseNone),
			chainCheck("C-2", 4, Unevaluated, CauseTimeout)),
	)
	got, err := Consolidate(chainOf(half, tuesday()))
	if err != nil {
		t.Fatalf("Consolidate: %v", err)
	}

	two := studentOf(t, got, "alumne02")
	if two.Score.Final != nil {
		t.Errorf("final_score = %d; mientras falte una comprobación no hay nota final", *two.Score.Final)
	}
	if two.Score.Status != ScoreIncomplete || two.Status != StudentPartial {
		t.Errorf("estado = %q/%q, want INCOMPLETE/PARTIAL", two.Score.Status, two.Status)
	}
	if two.Score.Unevaluated != 4 {
		t.Errorf("peso sin evaluar = %v, want 4", two.Score.Unevaluated)
	}

	// The reason the teacher reads is the last one that happened, not the first.
	for _, c := range two.Checks {
		if c.CheckID != "C-2" {
			continue
		}
		if c.Cause != CauseTimeout || c.FromRun != "RUN-MIERCOLES" {
			t.Errorf("C-2 = %q desde %q, want TIMEOUT desde RUN-MIERCOLES", c.Cause, c.FromRun)
		}
		if len(c.Attempts) != 1 || c.Attempts[0].Cause != CauseConnectFailed {
			t.Errorf("C-2 pierde el intento del martes: %+v", c.Attempts)
		}
	}
}

// TestConsolidateCountsOnlyRealAttempts: in the artifact of a retry, a check
// that was not selected appears UNEVALUATED with cause NOT_RUN (ADR-0018 §5).
// That is not an attempt and must not be recorded as one, or a student who was
// corrected once would read as having been tried twice.
func TestConsolidateCountsOnlyRealAttempts(t *testing.T) {
	// The Wednesday run carries alumne01 too, untouched, as a retry does.
	second := chainRun("RUN-MIERCOLES", 16,
		chainStudent("alumne01", 16,
			chainCheck("C-1", 6, Unevaluated, CauseNotRun),
			chainCheck("C-2", 4, Unevaluated, CauseNotRun)),
		chainStudent("alumne02", 16,
			chainCheck("C-1", 6, Pass, CauseNone),
			chainCheck("C-2", 4, Pass, CauseNone)),
	)

	got, err := Consolidate(chainOf(second, tuesday()))
	if err != nil {
		t.Fatalf("Consolidate: %v", err)
	}

	one := studentOf(t, got, "alumne01")
	if one.Score.Final == nil || *one.Score.Final != 60 {
		t.Fatalf("final_score de alumne01 = %v, want 60: el miércoles no se le tocó", one.Score.Final)
	}
	for _, c := range one.Checks {
		if c.FromRun != "RUN-MARTES" {
			t.Errorf("%s sale de %q, want RUN-MARTES", c.CheckID, c.FromRun)
		}
		if len(c.Attempts) != 0 {
			t.Errorf("%s cuenta como intento una ejecución en la que no se lanzó: %+v", c.CheckID, c.Attempts)
		}
	}
}

// TestConsolidateRefusesAnotherPlan: a chain with two PLANs is not a chain.
func TestConsolidateRefusesAnotherPlan(t *testing.T) {
	other := wednesday()
	other.PlanHash = "otro-hash"
	_, err := Consolidate(chainOf(other, tuesday()))
	if err == nil {
		t.Fatal("se consolidaron dos correcciones con PLAN distinto")
	}
	for _, want := range []string{"RUN-MARTES", "denominador"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("el error no dice %q: %v", want, err)
		}
	}
}

func TestConsolidateRefusesAnEmptyChain(t *testing.T) {
	if _, err := Consolidate(nil); err == nil {
		t.Fatal("se consolidó una cadena vacía")
	}
}

// TestConsolidateOneRun: a chain of one is the run itself. Consolidating it
// may not change a single grade.
func TestConsolidateOneRun(t *testing.T) {
	run := tuesday()
	got, err := Consolidate(chainOf(run))
	if err != nil {
		t.Fatalf("Consolidate: %v", err)
	}
	for _, want := range run.Students {
		s := studentOf(t, got, want.StudentID)
		if !sameScore(s.Score, want.Score) {
			t.Errorf("%s: la nota cambia al consolidar una sola corrección: %+v vs %+v",
				want.StudentID, s.Score, want.Score)
		}
		if s.Status != want.Status {
			t.Errorf("%s: estado %q, want %q", want.StudentID, s.Status, want.Status)
		}
	}
}

// TestConsolidateKeepsAnExcludedStudentExcluded: exclusion comes from the
// inventory, before any check exists, and no chain of runs changes it.
func TestConsolidateKeepsAnExcludedStudentExcluded(t *testing.T) {
	run := tuesday()
	run.Students = append(run.Students, StudentResult{
		StudentID: "alumne03", Name: "alumne03", Status: StudentExcluded,
		Score: Score{Total: 10, Status: ScoreExcluded},
	})
	got, err := Consolidate(chainOf(wednesday(), run))
	if err != nil {
		t.Fatalf("Consolidate: %v", err)
	}
	three := studentOf(t, got, "alumne03")
	if three.Status != StudentExcluded || three.Score.Status != ScoreExcluded {
		t.Errorf("alumne03 = %q/%q, want EXCLUDED/EXCLUDED", three.Status, three.Score.Status)
	}
	if three.Score.Final != nil {
		t.Errorf("un excluido sale con nota final %d", *three.Score.Final)
	}
}

// TestConsolidateCarriesNoStudentOutput: the consolidated view is a reading of
// results, not a copy of the evidence. The commands and the output of the
// machines stay in the artifact of the run that produced them, and only there
// (ADR-0018 §3, regla de secretos 8).
func TestConsolidateCarriesNoStudentOutput(t *testing.T) {
	run := tuesday()
	exit := 0
	run.Students[0].Checks[0].Execution = &ExecutionResult{
		Command:   []string{"cat", "/etc/shadow"},
		Completed: true,
		ExitCode:  &exit,
		Stdout:    Stream{Text: "contrasena-del-aula"},
	}
	run.Students[0].Checks[0].Assertion = &AssertionResult{Kind: "contains", Expected: "contrasena-del-aula", Matched: true}

	got, err := Consolidate(chainOf(run))
	if err != nil {
		t.Fatalf("Consolidate: %v", err)
	}
	data, err := MarshalCanonical(got)
	if err != nil {
		t.Fatalf("MarshalCanonical: %v", err)
	}
	for _, forbidden := range []string{"contrasena-del-aula", "/etc/shadow", "stdout"} {
		if strings.Contains(string(data), forbidden) {
			t.Errorf("la consolidación lleva %q dentro", forbidden)
		}
	}
	if !strings.Contains(string(data), `"kind": "consolidation"`) {
		t.Error("la consolidación no se identifica como tal y se podría leer como un artefacto")
	}
}
