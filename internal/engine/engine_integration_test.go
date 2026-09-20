//go:build integration

package engine

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"evalon/internal/model"
	"evalon/internal/plan"
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
		RunID:          "integration",
		EngineVersion:  "test",
		Secrets:        map[string]string{"AULA_PASSWORD": labPassword},
		KnownHostsPath: filepath.Join(t.TempDir(), "known_hosts"),
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
