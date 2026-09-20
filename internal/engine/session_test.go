package engine

import (
	"context"
	"reflect"
	"strings"
	"testing"

	"heimdall/internal/model"
)

// A round of an exam session: whoever the session already finished is left
// out, and everybody else is corrected exactly as before (ADR-0020 §4, T063).

// sessionWith builds the session view the round is given: the students named
// are the ones it already finished.
func sessionWith(planHash string, finished ...string) *model.Session {
	out := &model.Session{
		Version:  model.SessionVersion,
		Kind:     "session",
		PlanHash: planHash,
		Plan:     model.PlanSummary{CheckCount: 2, TotalWeight: 3, CheckIDs: []string{"c1", "c2"}},
	}
	done := map[string]bool{}
	for _, id := range finished {
		done[id] = true
	}
	for _, id := range []string{"alu1", "alu2"} {
		s := model.SessionStudent{StudentID: id, Name: id, Status: model.SessionActive}
		if done[id] {
			s.Status = model.SessionFinished
			s.FromRound = 2
			s.FromRunID = "R2"
		}
		out.Students = append(out.Students, s)
	}
	return out
}

// The student who already had the whole exam right is not dialled again, and
// the round says why instead of leaving them as a zero or as unevaluated.
func TestSessionLeavesTheFinishedStudentOut(t *testing.T) {
	p := testPlan(withUser(student("alu1"), "alu1"), withUser(student("alu2"), "alu2"))
	left, err := ExcludeFinished(p, sessionWith(p.Hash, "alu1"))
	if err != nil {
		t.Fatalf("ExcludeFinished: %v", err)
	}
	if left != 1 {
		t.Errorf("quedan %d alumnos por corregir, se esperaba 1", left)
	}

	dial, dials := dialerFor(map[string]Session{"alu1": echoSession(), "alu2": echoSession()}, nil)
	run := Run(context.Background(), p, Options{RunID: "R3", Secrets: secrets, Dial: dial})

	done := find(t, run, "alu1")
	if done.Status != model.StudentExcluded {
		t.Errorf("estado = %s, se esperaba %s", done.Status, model.StudentExcluded)
	}
	if done.Reason == "" || !strings.Contains(done.Reason, "vuelta 2") {
		t.Errorf("motivo = %q: el artefacto tiene que decir por qué no se corrigió y de qué vuelta viene su nota", done.Reason)
	}
	if done.Score.Status != model.ScoreExcluded {
		t.Errorf("estado de la nota = %s, se esperaba %s y nunca NOT_EVALUATED", done.Score.Status, model.ScoreExcluded)
	}
	if done.Score.Final != nil || done.Score.Obtained != 0 && done.Score.Status != model.ScoreExcluded {
		t.Errorf("nota = %v: una vuelta que no lo corrige no le pone ningún número", done.Score.Final)
	}
	if len(done.Checks) != 0 {
		t.Errorf("tiene %d comprobaciones: no se ejecutó ninguna", len(done.Checks))
	}

	// The whole acceptance criterion: not one connection against their machine.
	if n := dials.Load(); n != 1 {
		t.Errorf("se abrieron %d conexiones, se esperaba 1: la del alumno que sigue en la sesión", n)
	}
}

// The rest of the class gets exactly the same checks and the same weights as
// before: leaving somebody out is a decision of execution, never of grade
// (principio 7).
func TestSessionDoesNotMoveTheDenominator(t *testing.T) {
	p := testPlan(withUser(student("alu1"), "alu1"), withUser(student("alu2"), "alu2"))
	before := p.Summary
	hash := p.Hash
	if _, err := ExcludeFinished(p, sessionWith(p.Hash, "alu1")); err != nil {
		t.Fatalf("ExcludeFinished: %v", err)
	}
	if !reflect.DeepEqual(p.Summary, before) {
		t.Errorf("el PLAN cambió: %+v, era %+v", p.Summary, before)
	}
	if p.Hash != hash {
		t.Errorf("plan_hash = %s, era %s: una vuelta con menos alumnos sigue siendo el mismo examen", p.Hash, hash)
	}

	dial, _ := dialerFor(map[string]Session{"alu2": echoSession()}, nil)
	run := Run(context.Background(), p, Options{RunID: "R3", Secrets: secrets, Dial: dial})

	still := find(t, run, "alu2")
	if len(still.Checks) != 2 {
		t.Fatalf("el alumno que sigue tiene %d comprobaciones, se esperaban 2", len(still.Checks))
	}
	if still.Score.Total != 3 || still.Score.Obtained != 3 {
		t.Errorf("nota = %+v: el denominador y los pesos son los del PLAN", still.Score)
	}
	if run.Plan.TotalWeight != 3 || len(run.Plan.CheckIDs) != 2 {
		t.Errorf("el artefacto publica otro PLAN: %+v", run.Plan)
	}
}

// A session of another exam does not say who finished this one: it is a
// configuration error, and it is caught before anything is dialled.
func TestSessionOfAnotherExamIsRejected(t *testing.T) {
	p := testPlan(withUser(student("alu1"), "alu1"))
	if _, err := ExcludeFinished(p, sessionWith("otro-hash", "alu1")); err == nil {
		t.Fatal("una sesión de otro examen tiene que ser un error")
	}
	if p.Students[0].Excluded {
		t.Error("no se deja fuera a nadie a partir de una sesión que no es de este examen")
	}
}

// The student who is not finished yet is corrected again, whatever grade they
// already have: that is what the best-round rule exists to allow.
func TestSessionKeepsCorrectingTheActiveStudent(t *testing.T) {
	p := testPlan(withUser(student("alu1"), "alu1"), withUser(student("alu2"), "alu2"))
	if _, err := ExcludeFinished(p, sessionWith(p.Hash)); err != nil {
		t.Fatalf("ExcludeFinished: %v", err)
	}
	for _, sp := range p.Students {
		if sp.Excluded {
			t.Errorf("%s se quedó fuera y no había terminado", sp.ID)
		}
	}
}
