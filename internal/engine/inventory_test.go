package engine

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	"heimdall/internal/model"
	"heimdall/internal/plan"
)

// questionChecks are two checks without a command (M-11): the answer comes
// from aula.yaml and is compared straight away.
func questionChecks(p1, p9 string) []plan.ResolvedCheck {
	return []plan.ResolvedCheck{
		{ID: "p1", Group: "Cuestionario", Description: "Puerto de HTTPS", Weight: 1,
			Timeout: 5 * time.Second, Value: p1, Equals: str("443")},
		{ID: "p9", Group: "Cuestionario", Description: "Rango privado de clase A", Weight: 2,
			Timeout: 5 * time.Second, Value: p9, Contains: str("10.0.0.0/8")},
	}
}

func questionnairePlan(students ...plan.StudentPlan) *plan.Plan {
	p := testPlan(students...)
	p.Summary.CheckIDs = []string{"p1", "p9"}
	return p
}

// TestInventoryCheckNeedsNoMachine is the whole point of the valor:
// primitive. The original questionnaire ran ten `echo` with the student's
// answers interpolated into a shell string on the teacher's computer.
func TestInventoryCheckNeedsNoMachine(t *testing.T) {
	right := plan.StudentPlan{ID: "alu1", Name: "alu1", Checks: questionChecks("443", "10.0.0.0/8")}
	wrong := plan.StudentPlan{ID: "alu2", Name: "alu2", Checks: questionChecks("80", "172.16.0.0/12")}

	// A dialer that fails the test if it is ever called: nothing here may
	// open a connection.
	dial, dials := dialerFor(map[string]Session{}, nil)

	run := Run(context.Background(), questionnairePlan(right, wrong), Options{
		RunID: "R1", Secrets: secrets, Dial: dial, Concurrency: 2,
	})

	if n := dials.Load(); n != 0 {
		t.Errorf("un cuestionario abrió %d conexiones, y no debe abrir ninguna", n)
	}
	if ExitCode(run) != 0 {
		t.Errorf("exit code = %d, se esperaba 0", ExitCode(run))
	}

	good := find(t, run, "alu1")
	if good.Score.Final == nil || *good.Score.Final != 100 {
		t.Errorf("nota de alu1 = %v, se esperaba 100", good.Score.Final)
	}
	bad := find(t, run, "alu2")
	if bad.Score.Final == nil || *bad.Score.Final != 0 {
		t.Errorf("nota de alu2 = %v, se esperaba 0", bad.Score.Final)
	}

	// The artifact must say where the answer came from, so a PASS can be
	// audited like any other check.
	for _, c := range good.Checks {
		if c.Status != model.Pass {
			t.Errorf("%s = %s/%s: %s", c.CheckID, c.Status, c.Cause, c.Detail)
			continue
		}
		if c.Execution == nil {
			t.Fatalf("%s no registró de dónde salió el valor", c.CheckID)
		}
		if c.Execution.Transport != "inventory" {
			t.Errorf("%s: transport = %q, se esperaba inventory", c.CheckID, c.Execution.Transport)
		}
		if len(c.Execution.Command) != 0 {
			t.Errorf("%s ejecutó %v, y no debía ejecutar nada", c.CheckID, c.Execution.Command)
		}
		if c.Assertion == nil || !c.Assertion.Matched {
			t.Errorf("%s no dejó constancia de la comparación", c.CheckID)
		}
	}
}

// TestExcludedStudentDoesNotMoveTheOthersDenominator is the acceptance of
// excluido: true. The excluded student appears in the report with no grade,
// and everybody else is measured against the same total as always.
func TestExcludedStudentDoesNotMoveTheOthersDenominator(t *testing.T) {
	present := plan.StudentPlan{ID: "alu1", Name: "alu1", Checks: questionChecks("443", "10.0.0.0/8")}
	excluded := plan.StudentPlan{ID: "alu2", Name: "alu2", Excluded: true}

	alone := Run(context.Background(), questionnairePlan(present), Options{
		RunID: "R1", Secrets: secrets, Concurrency: 2,
	})
	together := Run(context.Background(), questionnairePlan(present, excluded), Options{
		RunID: "R2", Secrets: secrets, Concurrency: 2,
	})

	if a, b := find(t, alone, "alu1").Score, find(t, together, "alu1").Score; !reflect.DeepEqual(a, b) {
		t.Errorf("la nota de alu1 cambió con un compañero excluido: %s vs %s", show(b), show(a))
	}

	out := find(t, together, "alu2")
	if out.Status != model.StudentExcluded {
		t.Errorf("estado del excluido = %q", out.Status)
	}
	if out.Score.Final != nil || out.Score.Provisional != nil {
		t.Errorf("el alumno excluido tiene nota: %+v", out.Score)
	}
	if out.Score.Total != find(t, together, "alu1").Score.Total {
		t.Errorf("el excluido se mide sobre un total distinto: %v", out.Score.Total)
	}
	if len(out.Checks) != 0 {
		t.Errorf("el alumno excluido trae %d comprobaciones", len(out.Checks))
	}
}

// show prints a score with its two nullable grades resolved, so a failure
// message says 100 and not an address.
func show(s model.Score) string {
	grade := func(p *int) string {
		if p == nil {
			return "sin nota"
		}
		return fmt.Sprint(*p)
	}
	return fmt.Sprintf("obtenido %v de %v (evaluable %v), provisional %s, final %s, %s",
		s.Obtained, s.Total, s.Evaluable, grade(s.Provisional), grade(s.Final), s.Status)
}
