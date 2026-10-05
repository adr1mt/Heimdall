package engine

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"heimdall/internal/model"
	"heimdall/internal/plan"
	"heimdall/internal/ssh"
)

func fileStudent(id string, n int) plan.StudentPlan {
	sp := student(id)
	sp.Checks = nil
	for i := 0; i < n; i++ {
		c := twoChecks()[0]
		c.ID = fmt.Sprintf("f%d", i)
		c.Weight = 1
		c.File = "/etc/kea/kea-dhcp4.conf"
		c.Cmd = []string{"cat", "--", c.File}
		c.Contains = str("expected")
		sp.Checks = append(sp.Checks, c)
	}
	return sp
}
func filePlan(students ...plan.StudentPlan) *plan.Plan {
	p := testPlan(students...)
	p.Summary.CheckCount = len(students[0].Checks)
	p.Summary.TotalWeight = 0
	p.Summary.CheckIDs = nil
	for _, c := range students[0].Checks {
		p.Summary.CheckIDs = append(p.Summary.CheckIDs, c.ID)
		p.Summary.TotalWeight += c.Weight
	}
	return p
}
func fileDial(f func(context.Context, []string, time.Duration) *model.ExecutionResult) Dialer {
	return func(context.Context, ssh.Config) (Session, *ssh.DialError) { return &fakeSession{run: f}, nil }
}

func TestSharedFileKeepsIndependentGradesAndFreshRuns(t *testing.T) {
	a, b := fileStudent("a", 15), fileStudent("b", 15)
	a.Checks[7].Contains = str("missing")
	b.Checks[7].Contains = str("missing")
	p := filePlan(a, b)
	var calls atomic.Int64
	opts := Options{Secrets: secrets, Dial: fileDial(func(_ context.Context, argv []string, _ time.Duration) *model.ExecutionResult {
		calls.Add(1)
		e := okExec("expected")
		e.Command = append([]string(nil), argv...)
		return e
	})}
	for round := 0; round < 2; round++ {
		run := Run(context.Background(), p, opts)
		if calls.Load() != int64(2*(round+1)) {
			t.Fatalf("reads: %d", calls.Load())
		}
		for _, s := range run.Students {
			if len(s.Checks) != 15 || s.Score.Obtained != 14 || s.Score.Total != 15 {
				t.Fatalf("lost grades: %+v", s.Score)
			}
			for i, c := range s.Checks {
				want := model.Pass
				if i == 7 {
					want = model.Fail
				}
				if c.Status != want || !strings.Contains(c.Detail, `"f0"`) {
					t.Fatalf("%d: %+v", i, c)
				}
			}
			// Mutating one result container cannot alter the shared evidence of another.
			first, second := s.Checks[0].Execution, s.Checks[1].Execution
			if first == second {
				t.Fatal("mutable execution alias")
			}
			first.Command[0] = "changed"
			*first.ExitCode = 99
			first.Stdout.Text = "changed"
			if second.Command[0] != "cat" || *second.ExitCode != 0 || second.Stdout.Text != "expected" {
				t.Fatal("evidence alias")
			}
		}
	}
}

func TestSharedFileDoesNotCacheCommandsOrMergeHostsAndPaths(t *testing.T) {
	sp := fileStudent("a", 5)
	cmd := twoChecks()[0]
	cmd.ID = "cmd"
	sp.Checks = append(sp.Checks[:1], append([]plan.ResolvedCheck{cmd, cmd}, sp.Checks[1:]...)...)
	sp.Checks[2].ID = "cmd2"
	sp.Checks[4].File = "/etc/other"
	sp.Checks[4].Cmd = []string{"cat", "--", "/etc/other"}
	sp.Checks[5].Host = "other-host"
	var calls int
	opts := Options{Secrets: secrets, Dial: fileDial(func(_ context.Context, argv []string, _ time.Duration) *model.ExecutionResult {
		calls++
		return okExec("expected uno")
	})}
	run := Run(context.Background(), filePlan(sp), opts)
	if calls != 5 {
		t.Fatalf("reads and commands: %d, want 5", calls)
	}
	if run.Students[0].Checks[0].Execution.Stdout != run.Students[0].Checks[3].Execution.Stdout {
		t.Fatal("capture changed across commands")
	}
}

func TestSharedFileFailuresAndTruncation(t *testing.T) {
	for _, tc := range []struct {
		name   string
		exec   func() *model.ExecutionResult
		status model.AcademicStatus
		cause  model.Cause
	}{
		{"read error with matching partial stdout", func() *model.ExecutionResult {
			e := okExec("expected")
			*e.ExitCode = 1
			e.Stderr.Text = "permission denied"
			return e
		}, model.Fail, model.CauseNone},
		{"missing file", func() *model.ExecutionResult { e := okExec(""); *e.ExitCode = 1; return e }, model.Fail, model.CauseNone},
		{"lost connection", func() *model.ExecutionResult { return &model.ExecutionResult{} }, model.Unevaluated, model.CauseConnectionLost},
		{"timeout", func() *model.ExecutionResult { return &model.ExecutionResult{RemoteProcess: model.RemoteKilledRemote} }, model.Unevaluated, model.CauseTimeout},
		{"hard overflow", func() *model.ExecutionResult { return &model.ExecutionResult{Overflow: true} }, model.Unevaluated, model.CauseOutputOverflow},
		{"truncated witnessed presence", func() *model.ExecutionResult { e := okExec("expected"); e.Stdout.Truncated = true; return e }, model.Pass, model.CauseNone},
		{"truncated unproved presence", func() *model.ExecutionResult { e := okExec("prefix"); e.Stdout.Truncated = true; return e }, model.Unevaluated, model.CauseOutputOverflow},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			run := Run(context.Background(), filePlan(fileStudent("a", 2)), Options{Secrets: secrets, Dial: fileDial(func(context.Context, []string, time.Duration) *model.ExecutionResult { calls++; return tc.exec() })})
			if calls != 1 {
				t.Fatalf("failed read repeated: %d", calls)
			}
			for _, c := range run.Students[0].Checks {
				if c.Status != tc.status || c.Cause != tc.cause || !strings.Contains(c.Detail, "Lectura compartida") {
					t.Fatalf("result: %+v", c)
				}
			}
		})
	}
	// A single prefix may prove one assertion while leaving another unevaluated.
	sp := fileStudent("a", 4)
	sp.Checks[1].Contains = nil
	sp.Checks[1].Equals = str("expected")
	sp.Checks[2].Contains = nil
	sp.Checks[2].NotContains = str("absent")
	sp.Checks[3].Contains = nil
	sp.Checks[3].NotContains = str("expected")
	run := Run(context.Background(), filePlan(sp), Options{Secrets: secrets, Dial: fileDial(func(context.Context, []string, time.Duration) *model.ExecutionResult {
		e := okExec("expected")
		e.Stdout.Truncated = true
		return e
	})})
	got := []model.AcademicStatus{}
	for _, c := range run.Students[0].Checks {
		got = append(got, c.Status)
	}
	if !reflect.DeepEqual(got, []model.AcademicStatus{model.Pass, model.Unevaluated, model.Unevaluated, model.Fail}) {
		t.Fatal(got)
	}
}

func TestSharedFileCancellationAndBudgetPrecedeCache(t *testing.T) {
	for _, budget := range []bool{false, true} {
		ctx, cancel := context.WithCancel(context.Background())
		p := filePlan(fileStudent("a", 2))
		if budget {
			p.StudentBudget = time.Millisecond
		}
		calls := 0
		run := Run(ctx, p, Options{Secrets: secrets, Dial: fileDial(func(context.Context, []string, time.Duration) *model.ExecutionResult {
			calls++
			if budget {
				time.Sleep(3 * time.Millisecond)
			} else {
				cancel()
			}
			return okExec("expected")
		})})
		cancel()
		want := model.CauseCancelled
		if budget {
			want = model.CauseNotRun
		}
		if calls != 1 || run.Students[0].Checks[1].Cause != want {
			t.Fatalf("cache ignored context: %+v", run.Students[0].Checks)
		}
	}
}

func TestSharedFileRetryReadsOnlySelectedChecksWithFreshCapture(t *testing.T) {
	sp := fileStudent("a", 3)
	p := filePlan(sp)
	retry := &Retry{Previous: map[string]map[string]model.PreviousAttempt{"a": {"f0": {Status: model.Pass}, "f1": {Status: model.Unevaluated}, "f2": {Status: model.Unevaluated}}}}
	calls := 0
	opts := Options{Secrets: secrets, Retry: retry, Dial: fileDial(func(context.Context, []string, time.Duration) *model.ExecutionResult {
		calls++
		return okExec("expected")
	})}
	for i := 0; i < 2; i++ {
		run := Run(context.Background(), p, opts)
		if run.Students[0].Checks[0].Execution != nil || !strings.Contains(run.Students[0].Checks[2].Detail, `"f1"`) {
			t.Fatal(run.Students[0].Checks)
		}
	}
	if calls != 2 {
		t.Fatalf("retry capture not fresh: %d", calls)
	}
}

func TestSharedFileRefreshesContentBetweenSessionRounds(t *testing.T) {
	p := filePlan(fileStudent("a", 2))
	text := "expected"
	calls := 0
	opts := Options{Secrets: secrets, Dial: fileDial(func(context.Context, []string, time.Duration) *model.ExecutionResult { calls++; return okExec(text) })}
	first := Run(context.Background(), p, opts)
	text = "changed"
	second := Run(context.Background(), p, opts)
	if calls != 2 || first.Students[0].Checks[1].Status != model.Pass || second.Students[0].Checks[1].Status != model.Fail {
		t.Fatal("session round reused earlier capture")
	}
}

func TestSharedFileConnectionErrorsKeepExplanation(t *testing.T) {
	for _, cause := range []model.Cause{model.CauseConnectFailed, model.CauseAuthFailed} {
		calls := 0
		run := Run(context.Background(), filePlan(fileStudent("a", 2)), Options{Secrets: secrets, Dial: func(context.Context, ssh.Config) (Session, *ssh.DialError) {
			calls++
			return nil, &ssh.DialError{Cause: cause, Detail: "connection problem"}
		}})
		if calls != 1 {
			t.Fatal("connection retried")
		}
		for _, c := range run.Students[0].Checks {
			if c.Cause != cause || c.Execution != nil || !strings.Contains(c.Detail, "connection problem") || !strings.Contains(c.Detail, "Lectura compartida") {
				t.Fatal(c)
			}
		}
	}
}

func TestSharedFileResultsConsolidateAfterSelectiveRetry(t *testing.T) {
	sp := fileStudent("a", 2)
	sp.Checks[1].Contains = str("missing")
	p := filePlan(sp)
	calls := 0
	first := Run(context.Background(), p, Options{RunID: "FIRST", EngineVersion: "test", Secrets: secrets, Dial: fileDial(func(context.Context, []string, time.Duration) *model.ExecutionResult {
		calls++
		e := okExec("expected")
		e.Stdout.Truncated = true
		return e
	})})
	if first.Students[0].Checks[0].Status != model.Pass || first.Students[0].Checks[1].Status != model.Unevaluated {
		t.Fatal("prefix classification changed")
	}
	retry := previous("FIRST", map[string]map[string]model.AcademicStatus{"a": {"f0": model.Pass, "f1": model.Unevaluated}})
	second := Run(context.Background(), p, Options{RunID: "SECOND", EngineVersion: "test", Secrets: secrets, Retry: retry, Dial: fileDial(func(context.Context, []string, time.Duration) *model.ExecutionResult {
		calls++
		return okExec("expected missing")
	})})
	joined, err := model.Consolidate([]model.ChainLink{{Artifact: "run-SECOND.json", Run: second}, {Artifact: "run-FIRST.json", Run: first}})
	if err != nil {
		t.Fatal(err)
	}
	if calls != 2 || joined.Students[0].Score.Obtained != 2 || joined.Students[0].Score.Final == nil || *joined.Students[0].Score.Final != 100 {
		t.Fatalf("consolidation: %+v", joined)
	}
	if joined.Students[0].Checks[0].FromRun != "FIRST" || joined.Students[0].Checks[1].FromRun != "SECOND" {
		t.Fatal("consolidation lost evidence origin")
	}
}
