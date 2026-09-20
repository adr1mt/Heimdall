//go:build integration

package engine

import (
	"context"
	"strings"
	"testing"

	"heimdall/internal/model"
	"heimdall/internal/plan"
)

// The lab credentials are fictitious and only valid inside the container
// (test/README.md). No real credential is ever used in a test.
const labPassword = "TEUTON_SECRET_TEST_12345"

// TestPrototypeAgainstTheLab runs the prototype exam against the real
// container. alumne01 is the machine that is up; alumne02 points at a closed
// port and is the broken student.
//
// Needs `make lab`.
func TestPrototypeAgainstTheLab(t *testing.T) {
	p, err := plan.Load("../../testdata/proto")
	if err != nil {
		t.Fatalf("el PLAN del prototipo no resuelve: %v", err)
	}

	opts := Options{
		RunID:         "integration",
		EngineVersion: "test",
		Secrets:       map[string]string{"AULA_PASSWORD": labPassword},
	}
	run := Run(context.Background(), p, opts)

	if len(run.Students) != 2 {
		t.Fatalf("el artefacto debe contener a los dos alumnos, tiene %d", len(run.Students))
	}

	good := find(t, run, "alumne01")
	want := map[string]struct {
		status model.AcademicStatus
		cause  model.Cause
	}{
		"p1-hostname": {model.Pass, model.CauseNone},
		"p2-usuario":  {model.Pass, model.CauseNone},
		"p3-fichero":  {model.Pass, model.CauseNone},
		// A command that does not exist on the student's machine is a failed
		// check, never a fault of the engine.
		"p4-ausente": {model.Fail, model.CauseNone},
		// The slow one times out: UNEVALUATED, and it does not become a FAIL.
		"p5-lento": {model.Unevaluated, model.CauseTimeout},
	}
	for _, c := range good.Checks {
		w, ok := want[c.CheckID]
		if !ok {
			t.Errorf("comprobación inesperada %q", c.CheckID)
			continue
		}
		if c.Status != w.status || c.Cause != w.cause {
			t.Errorf("%s: %q/%q, se esperaba %q/%q (%s)", c.CheckID, c.Status, c.Cause, w.status, w.cause, c.Detail)
		}
	}
	if good.Status != model.StudentPartial {
		t.Errorf("alumne01 debería ser PARTIAL por el timeout, es %q", good.Status)
	}
	if good.Score.Final != nil {
		t.Errorf("con una comprobación sin evaluar no hay nota final: %+v", good.Score)
	}
	if good.Score.Provisional == nil || *good.Score.Provisional != 80 {
		t.Errorf("provisional: %+v, se esperaba 80 (4 de 5 puntos evaluables)", good.Score)
	}

	broken := find(t, run, "alumne02")
	for _, c := range broken.Checks {
		if c.Status != model.Unevaluated || c.Cause != model.CauseConnectFailed {
			t.Errorf("alumne02 %s: %q/%q, se esperaba UNEVALUATED/CONNECT_FAILED", c.CheckID, c.Status, c.Cause)
		}
	}
	if broken.Status != model.StudentNotEvaluated {
		t.Errorf("alumne02 debería ser NOT_EVALUATED, es %q", broken.Status)
	}

	if run.Status != model.RunPartial || ExitCode(run) != 3 {
		t.Errorf("la ejecución es parcial: %q, exit %d", run.Status, ExitCode(run))
	}

	// The same run without the broken student must grade alumne01 identically.
	alone := *p
	alone.Students = []plan.StudentPlan{p.Students[0]}
	solo := Run(context.Background(), &alone, opts)
	a, b := good, find(t, solo, "alumne01")
	for i := range a.Checks {
		x, y := a.Checks[i], b.Checks[i]
		if x.CheckID != y.CheckID || x.Status != y.Status || x.Cause != y.Cause || x.Weight != y.Weight {
			t.Errorf("%s cambia al quitar al alumno roto: %q/%q vs %q/%q",
				x.CheckID, x.Status, x.Cause, y.Status, y.Cause)
		}
	}
	if a.Score.Obtained != b.Score.Obtained || a.Score.Evaluable != b.Score.Evaluable || a.Score.Total != b.Score.Total {
		t.Errorf("la nota de alumne01 cambia con el alumno roto al lado: %+v vs %+v", a.Score, b.Score)
	}

	// The password must not appear anywhere in the artifact.
	data, err := model.MarshalCanonical(run)
	if err != nil {
		t.Fatalf("serializar el artefacto: %v", err)
	}
	if strings.Contains(string(data), labPassword) {
		t.Error("la contraseña aparece en el artefacto")
	}
}

// TestOverflowIsNotALostConnection is the acceptance of T032: a machine that
// prints 300 MB has its check cut off, and the reason that reaches the
// artifact must name the overflow. What was read stays in the report, and the
// student is not failed for it.
//
// Needs `make lab`.
func TestOverflowIsNotALostConnection(t *testing.T) {
	p, err := plan.Load("../../testdata/salida-grande")
	if err != nil {
		t.Fatalf("el PLAN de salida grande no resuelve: %v", err)
	}

	run := Run(context.Background(), p, Options{
		RunID:         "integration-overflow",
		EngineVersion: "test",
		Secrets:       map[string]string{"AULA_PASSWORD": labPassword},
	})

	s := find(t, run, "alumne01")
	if len(s.Checks) != 1 {
		t.Fatalf("el examen tiene una sola comprobación, hay %d", len(s.Checks))
	}
	c := s.Checks[0]
	if c.Status != model.Unevaluated || c.Cause != model.CauseOutputOverflow {
		t.Errorf("%s: %q/%q, se esperaba UNEVALUATED/OUTPUT_OVERFLOW (%s)",
			c.CheckID, c.Status, c.Cause, c.Detail)
	}
	if c.Detail == "" {
		t.Error("una comprobación sin evaluar nunca se queda sin explicación")
	}
	if c.Execution == nil {
		t.Fatal("la ejecución debe llegar al artefacto aunque se cortara")
	}
	if !c.Execution.Overflow {
		t.Error("la ejecución no está marcada como desbordada")
	}
	// The 64 kB that were read are the point of the task: they stay in the
	// report so the teacher can see what the machine was answering.
	if c.Execution.Stdout.Bytes == 0 || !c.Execution.Stdout.Truncated {
		t.Errorf("lo leído debe conservarse y marcarse truncado: %+v", c.Execution.Stdout)
	}
	if s.Score.Final != nil || s.Score.Status != model.ScoreNotEvaluated {
		t.Errorf("nadie suspende por una salida enorme: %+v", s.Score)
	}
}
