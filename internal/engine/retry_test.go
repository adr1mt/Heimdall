package engine

import (
	"context"
	"testing"

	"heimdall/internal/model"
)

// previous builds the selection of a repeat run out of what each check was
// last time, written as a status per check id.
func previous(runID string, byStudent map[string]map[string]model.AcademicStatus) *Retry {
	out := map[string]map[string]model.PreviousAttempt{}
	for id, checks := range byStudent {
		out[id] = map[string]model.PreviousAttempt{}
		for checkID, status := range checks {
			cause := model.CauseNone
			if status == model.Unevaluated {
				cause = model.CauseConnectFailed
			}
			out[id][checkID] = model.PreviousAttempt{
				RunID: runID, Status: status, Cause: cause,
			}
		}
	}
	return &Retry{
		Ref:      model.RetryRef{RunID: runID, Artifact: "var/run-" + runID + ".json"},
		Previous: out,
	}
}

func checkOf(t *testing.T, s model.StudentResult, id string) model.CheckResult {
	t.Helper()
	for _, c := range s.Checks {
		if c.CheckID == id {
			return c
		}
	}
	t.Fatalf("el alumno %s no tiene la comprobación %q", s.StudentID, id)
	return model.CheckResult{}
}

// A repeat run executes what was left unevaluated and nothing else. A FAIL is
// not retried: repeating it would hand that student an attempt the rest of
// the class never got (ADR-0018 §2).
func TestRetryOnlyRunsTheUnevaluatedChecks(t *testing.T) {
	alu := withUser(student("alu1"), "alu1")
	dial, dials := dialerFor(map[string]Session{"alu1": echoSession()}, nil)

	retry := previous("R1", map[string]map[string]model.AcademicStatus{
		"alu1": {"c1": model.Fail, "c2": model.Unevaluated},
	})
	run := Run(context.Background(), testPlan(alu), Options{
		RunID: "R2", Secrets: secrets, Dial: dial, Retry: retry,
	})

	s := find(t, run, "alu1")
	c1 := checkOf(t, s, "c1")
	if c1.Status != model.Unevaluated || c1.Cause != model.CauseNotRun {
		t.Errorf("c1 había fallado: no se repite y sale NOT_RUN, no %s/%s", c1.Status, c1.Cause)
	}
	if c1.Execution != nil {
		t.Error("c1 no se ejecutó, así que no puede llevar ejecución")
	}
	if c2 := checkOf(t, s, "c2"); c2.Status != model.Pass {
		t.Errorf("c2 estaba sin evaluar: se repite y ahora sale %s", c2.Status)
	}
	if dials.Load() == 0 {
		t.Error("el reintento tenía algo que ejecutar y no abrió ninguna sesión")
	}
}

// A retry never fabricates a grade: while a check has no result in this run,
// final_score stays null and the denominator is still the PLAN's (ADR-0004,
// ADR-0006).
func TestRetryKeepsTheDenominatorAndGivesNoFinalGrade(t *testing.T) {
	alu := withUser(student("alu1"), "alu1")
	dial, _ := dialerFor(map[string]Session{"alu1": echoSession()}, nil)

	retry := previous("R1", map[string]map[string]model.AcademicStatus{
		"alu1": {"c1": model.Pass, "c2": model.Unevaluated},
	})
	run := Run(context.Background(), testPlan(alu), Options{
		RunID: "R2", Secrets: secrets, Dial: dial, Retry: retry,
	})

	s := find(t, run, "alu1")
	if s.Score.Total != 3 {
		t.Errorf("el denominador es el del PLAN, 3, y no %v", s.Score.Total)
	}
	if s.Score.Final != nil {
		t.Errorf("queda una comprobación sin evaluar en esta ejecución: no hay nota final, y hay %d", *s.Score.Final)
	}
	if s.Score.Status != model.ScoreIncomplete {
		t.Errorf("la nota es INCOMPLETE y no %s", s.Score.Status)
	}
	if s.Status != model.StudentPartial {
		t.Errorf("el alumno queda PARTIAL y no %s", s.Status)
	}
}

// The evidence of the previous attempt survives the retry: every check says
// what it was and in which run (ADR-0018 §3).
func TestRetryKeepsTheEvidenceOfThePreviousAttempt(t *testing.T) {
	alu := withUser(student("alu1"), "alu1")
	dial, _ := dialerFor(map[string]Session{"alu1": echoSession()}, nil)

	retry := previous("R1", map[string]map[string]model.AcademicStatus{
		"alu1": {"c1": model.Pass, "c2": model.Unevaluated},
	})
	run := Run(context.Background(), testPlan(alu), Options{
		RunID: "R2", Secrets: secrets, Dial: dial, Retry: retry,
	})

	if run.RetryOf == nil || run.RetryOf.RunID != "R1" {
		t.Fatal("el artefacto no dice de qué ejecución viene")
	}
	s := find(t, run, "alu1")
	for _, id := range []string{"c1", "c2"} {
		c := checkOf(t, s, id)
		if c.Previous == nil {
			t.Errorf("%s ha perdido el rastro del intento anterior", id)
			continue
		}
		if c.Previous.RunID != "R1" {
			t.Errorf("%s dice venir de %q y no de R1", id, c.Previous.RunID)
		}
	}
	if got := checkOf(t, s, "c2").Previous.Cause; got != model.CauseConnectFailed {
		t.Errorf("c2 tiene que conservar la causa de por qué no se pudo evaluar, y lleva %s", got)
	}
}

// Without a retry nothing changes: an ordinary run carries no previous
// attempt and no provenance.
func TestRunWithoutRetryCarriesNoPreviousAttempt(t *testing.T) {
	alu := withUser(student("alu1"), "alu1")
	dial, _ := dialerFor(map[string]Session{"alu1": echoSession()}, nil)
	run := Run(context.Background(), testPlan(alu), Options{RunID: "R1", Secrets: secrets, Dial: dial})

	if run.RetryOf != nil {
		t.Error("una ejecución normal no repite ninguna otra")
	}
	for _, c := range find(t, run, "alu1").Checks {
		if c.Previous != nil {
			t.Errorf("%s lleva un intento anterior que nunca existió", c.CheckID)
		}
	}
}
