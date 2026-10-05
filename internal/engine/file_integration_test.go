//go:build integration

package engine

import (
	"context"
	"reflect"
	"sync/atomic"
	"testing"
	"time"

	"heimdall/internal/model"
	"heimdall/internal/plan"
	"heimdall/internal/ssh"
)

// measuredSession counts actual transport calls, never repeated evidence.
type measuredSession struct {
	Session
	calls, bytes *atomic.Int64
}

func (s *measuredSession) Run(ctx context.Context, argv []string, timeout time.Duration) *model.ExecutionResult {
	s.calls.Add(1)
	out := s.Session.Run(ctx, argv, timeout)
	s.bytes.Add(out.Stdout.BytesTotal + out.Stderr.BytesTotal)
	return out
}

func TestKeaSharedFileReadsAgainstSSH(t *testing.T) {
	p, err := plan.Load("../../testdata/shared-files")
	if err != nil {
		t.Fatal(err)
	}
	var previous *model.RunResult
	for _, shared := range []bool{false, true} {
		current := *p
		current.Students = append([]plan.StudentPlan(nil), p.Students...)
		for i := range current.Students {
			current.Students[i].Checks = append([]plan.ResolvedCheck(nil), p.Students[i].Checks...)
			if !shared {
				for j := range current.Students[i].Checks {
					current.Students[i].Checks[j].File = ""
				}
			}
		}
		var calls, bytes atomic.Int64
		run := Run(context.Background(), &current, Options{Secrets: map[string]string{"AULA_PASSWORD": "HEIMDALL_SECRET_RA2_TEST"}, Dial: func(ctx context.Context, cfg ssh.Config) (Session, *ssh.DialError) {
			s, err := SSHDialer(ctx, cfg)
			if err != nil {
				return nil, err
			}
			return &measuredSession{Session: s, calls: &calls, bytes: &bytes}, nil
		}})
		want := int64(450)
		if shared {
			want = 30
		}
		if calls.Load() != want {
			t.Fatalf("shared=%v: %d actual calls, want %d; first cause=%s detail=%s", shared, calls.Load(), want, run.Students[0].Checks[0].Cause, run.Students[0].Checks[0].Detail)
		}
		if run.Status != model.RunComplete || len(run.Students) != 30 {
			t.Fatalf("incomplete SSH correction: %+v", run)
		}
		for i, s := range run.Students {
			if len(s.Checks) != 15 || s.Score.Obtained != 15 {
				t.Fatalf("student %s: %+v", s.StudentID, s.Score)
			}
			if shared {
				if !reflect.DeepEqual(s.Score, previous.Students[i].Score) {
					t.Fatal("score changed")
				}
				for j, c := range s.Checks {
					a := previous.Students[i].Checks[j]
					if c.Status != a.Status || c.Cause != a.Cause || c.Weight != a.Weight || !reflect.DeepEqual(c.Assertion, a.Assertion) {
						t.Fatalf("conclusion changed: %s/%s", s.StudentID, c.CheckID)
					}
				}
			}
		}
		t.Logf("shared=%v actual_reads=%d received_content_bytes=%d", shared, calls.Load(), bytes.Load())
		previous = run
	}
}
