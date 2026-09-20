package engine

import (
	"context"
	"sync"
	"testing"
	"time"

	"heimdall/internal/model"
	"heimdall/internal/ssh"
)

// recorder collects the live report of a run. It locks because the engine
// reports from every worker at once.
type recorder struct {
	mu       sync.Mutex
	starts   []string
	checks   []string // "student/check:STATUS"
	ends     []string
	statuses map[string]model.AcademicStatus
}

func newRecorder() *recorder {
	return &recorder{statuses: map[string]model.AcademicStatus{}}
}

func (r *recorder) progress() *Progress {
	return &Progress{
		StudentStart: func(id, _ string) {
			r.mu.Lock()
			defer r.mu.Unlock()
			r.starts = append(r.starts, id)
		},
		CheckDone: func(id string, c model.CheckResult) {
			r.mu.Lock()
			defer r.mu.Unlock()
			r.checks = append(r.checks, id+"/"+c.CheckID)
			r.statuses[id+"/"+c.CheckID] = c.Status
		},
		StudentEnd: func(res model.StudentResult) {
			r.mu.Lock()
			defer r.mu.Unlock()
			r.ends = append(r.ends, res.StudentID)
		},
	}
}

// Every check of every student is reported exactly once, whatever happened to
// it: that is what makes the progress bar exact instead of approximate.
func TestProgressReportsEveryCheckExactlyOnce(t *testing.T) {
	sessions := map[string]Session{
		"alu1": &fakeSession{run: func(context.Context, []string, time.Duration) *model.ExecutionResult {
			return okExec("uno dos")
		}},
		"alu2": &fakeSession{run: func(context.Context, []string, time.Duration) *model.ExecutionResult {
			return okExec("uno dos")
		}},
	}
	dial, _ := dialerFor(sessions, nil)
	p := testPlan(withUser(student("alu1"), "alu1"), withUser(student("alu2"), "alu2"))

	rec := newRecorder()
	run := Run(context.Background(), p, Options{
		Secrets:  secrets,
		Dial:     dial,
		Progress: rec.progress(),
	})

	if len(rec.starts) != 2 || len(rec.ends) != 2 {
		t.Errorf("empezaron %d alumnos y terminaron %d, se esperaban 2 y 2", len(rec.starts), len(rec.ends))
	}
	seen := map[string]int{}
	for _, c := range rec.checks {
		seen[c]++
	}
	want := []string{"alu1/c1", "alu1/c2", "alu2/c1", "alu2/c2"}
	if len(seen) != len(want) {
		t.Fatalf("se informaron %d comprobaciones distintas, se esperaban %d: %v", len(seen), len(want), rec.checks)
	}
	for _, id := range want {
		if seen[id] != 1 {
			t.Errorf("la comprobación %s se informó %d veces", id, seen[id])
		}
	}

	// What the stream said must be what the artifact says.
	for _, s := range run.Students {
		for _, c := range s.Checks {
			if got := rec.statuses[s.StudentID+"/"+c.CheckID]; got != c.Status {
				t.Errorf("%s/%s: el flujo dijo %s y el artefacto dice %s",
					s.StudentID, c.CheckID, got, c.Status)
			}
		}
	}
}

// A student whose machine never answers still reports every check: the GUI
// must not sit waiting for progress that is never coming.
func TestProgressReportsTheChecksOfAStudentThatNeverConnected(t *testing.T) {
	dial, _ := dialerFor(nil, map[string]*ssh.DialError{
		"alu1": {Cause: model.CauseConnectFailed, Detail: "la máquina no responde"},
	})
	p := testPlan(withUser(student("alu1"), "alu1"))

	rec := newRecorder()
	Run(context.Background(), p, Options{Secrets: secrets, Dial: dial, Progress: rec.progress()})

	if len(rec.checks) != 2 {
		t.Fatalf("se informaron %d comprobaciones, se esperaban 2: %v", len(rec.checks), rec.checks)
	}
	for id, status := range rec.statuses {
		if status != model.Unevaluated {
			t.Errorf("%s = %s, se esperaba UNEVALUATED", id, status)
		}
	}
}

// Nobody watching is the default and it must cost nothing.
func TestARunWithoutProgressWorks(t *testing.T) {
	sessions := map[string]Session{
		"alu1": &fakeSession{run: func(context.Context, []string, time.Duration) *model.ExecutionResult {
			return okExec("uno dos")
		}},
	}
	dial, _ := dialerFor(sessions, nil)
	p := testPlan(withUser(student("alu1"), "alu1"))

	run := Run(context.Background(), p, Options{Secrets: secrets, Dial: dial})
	if run.Status != model.RunComplete {
		t.Errorf("status = %s, se esperaba COMPLETE", run.Status)
	}
}
