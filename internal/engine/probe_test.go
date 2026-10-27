package engine

import (
	"context"
	"heimdall/internal/model"
	"heimdall/internal/probe"
	"strings"
	"testing"
	"time"
)

func TestProbeTechnicalFailuresNeverBecomeGrades(t *testing.T) {
	for _, tc := range []struct {
		name, output string
		code         int
		status       model.AcademicStatus
	}{
		{"correct", "OK\n", 0, model.Pass}, {"incorrect", "FAIL\n", 0, model.Fail},
		{"no python", "", 127, model.Unevaluated}, {"permissions", "", 70, model.Unevaluated},
		{"interpreter crash", "", 1, model.Unevaluated}, {"malformed reply", "garbage", 0, model.Unevaluated},
		{"false success on crash", "OK", 70, model.Unevaluated},
	} {
		t.Run(tc.name, func(t *testing.T) {
			sp := withUser(student("alu1"), "alu1")
			c := &sp.Checks[0]
			c.Probe = true
			c.Contains = nil
			c.Equals = str("OK")
			c.Cmd = []string{"heimdall:comprobador", "ra1-dhcp", probe.Revision(), "kea-reserva-mail", "wan0", "lan0", "192.168.236.60"}
			sess := &fakeSession{run: func(_ context.Context, argv []string, _ time.Duration) *model.ExecutionResult {
				if argv[0] == "python3" {
					if argv[1] != "-I" || !strings.Contains(argv[3], "def evaluate") || argv[4] != "kea-reserva-mail" {
						t.Fatal("wrong fixed program or args")
					}
					out := okExec(tc.output)
					out.ExitCode = &tc.code
					return out
				}
				return okExec("dos")
			}}
			dial, _ := dialerFor(map[string]Session{"alu1": sess}, nil)
			run := Run(context.Background(), testPlan(sp), Options{RunID: "R", Secrets: secrets, Dial: dial})
			got := find(t, run, "alu1")
			check := got.Checks[0]
			if check.Status != tc.status {
				t.Fatalf("%s: %s %s", tc.name, check.Status, check.Detail)
			}
			if check.Execution.Command[0] != "heimdall:comprobador" {
				t.Fatal("missing source identity")
			}
			if tc.status == model.Unevaluated {
				if check.Cause != model.CauseEngineError || check.Assertion != nil || got.Score.Status != model.ScoreIncomplete {
					t.Fatalf("technical error graded: %+v", check)
				}
			}
			if got.Checks[1].Status != model.Pass {
				t.Fatal("probe failure affected next check")
			}
		})
	}
}
