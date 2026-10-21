package engine

import (
	"context"
	"testing"
	"time"

	"heimdall/internal/model"
	"heimdall/internal/ssh"
)

func runSudoChecks(t *testing.T, sess *fakeSession) model.StudentResult {
	t.Helper()
	sp := withUser(student("alu1"), "alu1")
	for i := range sp.Checks {
		sp.Checks[i].Sudo = true
	}
	dial, _ := dialerFor(map[string]Session{"alu1": sess}, nil)
	run := Run(context.Background(), testPlan(sp), Options{RunID: "R", Secrets: secrets, Dial: dial})
	return find(t, run, "alu1")
}

// TestSudoChecksGoThroughSudo: a check that says sudo is run through RunSudo
// and graded like any other on what the command printed.
func TestSudoChecksGoThroughSudo(t *testing.T) {
	plain := 0
	sess := &fakeSession{
		run: func(context.Context, []string, time.Duration) *model.ExecutionResult {
			plain++
			return okExec("")
		},
		sudo: func(argv []string) (*model.ExecutionResult, *ssh.SudoRefused) {
			return okExec(argv[len(argv)-1]), nil
		},
	}
	got := runSudoChecks(t, sess)
	if plain != 0 {
		t.Fatalf("una comprobación con sudo no debe ejecutarse sin sudo (%d veces)", plain)
	}
	for _, c := range got.Checks {
		if c.Status != model.Pass {
			t.Fatalf("%s: %s/%s, se esperaba PASS", c.CheckID, c.Status, c.Cause)
		}
	}
}

// TestSudoRefusalIsNeverAFail is principle 3: when sudo does not start the
// command, nothing of the student was looked at. The check is UNEVALUATED
// with AUTH_FAILED, it stays out of the denominator, and sudo is not asked
// again on that host with the same password.
func TestSudoRefusalIsNeverAFail(t *testing.T) {
	asked := 0
	sess := &fakeSession{
		run: func(context.Context, []string, time.Duration) *model.ExecutionResult { return okExec("") },
		sudo: func([]string) (*model.ExecutionResult, *ssh.SudoRefused) {
			asked++
			code := 1
			exec := &model.ExecutionResult{
				Completed: true, ExitCode: &code, RemoteProcess: model.RemoteFinished,
				Stderr: model.Stream{Text: "Sorry, try again.", Bytes: 17, BytesTotal: 17},
			}
			return exec, &ssh.SudoRefused{Detail: "sudo no aceptó la contraseña"}
		},
	}
	got := runSudoChecks(t, sess)
	if asked != 1 {
		t.Fatalf("sudo se ha pedido %d veces en el mismo host; debe pedirse una", asked)
	}
	for _, c := range got.Checks {
		if c.Status != model.Unevaluated || c.Cause != model.CauseAuthFailed {
			t.Fatalf("%s: %s/%s, se esperaba UNEVALUATED/AUTH_FAILED", c.CheckID, c.Status, c.Cause)
		}
		if c.Detail != "sudo no aceptó la contraseña" {
			t.Fatalf("%s: el motivo debe ser el de sudo, es %q", c.CheckID, c.Detail)
		}
		if c.Execution != nil && (c.Execution.Completed || c.Execution.ExitCode != nil) {
			t.Fatalf("%s: la respuesta de sudo no puede quedar como una ejecución completa del alumno", c.CheckID)
		}
	}
	if got.Score.Status != model.ScoreNotEvaluated {
		t.Fatalf("sin nada evaluado la nota es %s, se esperaba NOT_EVALUATED", got.Score.Status)
	}
}
