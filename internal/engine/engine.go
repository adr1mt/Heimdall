// Package engine runs a resolved PLAN against every student in it.
//
// It is the piece that holds principle 4 up: one broken student must not cost
// the rest of the class anything. Every student gets its own context, its own
// sessions and its own budget, and a student that crashes, hangs or refuses
// to connect ends as UNEVALUATED checks in the artifact while the others
// finish normally.
//
// The PLAN is read-only here (ADR-0002): the engine never adds, removes or
// reweights a check, whatever happens on a machine.
package engine

import (
	"context"
	"fmt"
	"sync"
	"time"

	"evalon/internal/model"
	"evalon/internal/plan"
	"evalon/internal/ssh"
)

// Session is what the engine needs from an authenticated connection. The
// interface exists so the engine can be tested without a machine: the only
// implementation in production is *ssh.Session.
type Session interface {
	Run(ctx context.Context, argv []string, timeout time.Duration) *model.ExecutionResult
	Warnings() []model.Warning
	Close() error
}

// Dialer opens one session. It returns a *ssh.DialError, which already
// carries the technical cause in the vocabulary of the artifact.
type Dialer func(ctx context.Context, cfg ssh.Config) (Session, *ssh.DialError)

// SSHDialer is the real dialer.
func SSHDialer(ctx context.Context, cfg ssh.Config) (Session, *ssh.DialError) {
	s, err := ssh.Dial(ctx, cfg)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// Options are what the caller supplies around the PLAN. Everything here comes
// from the CLI; the engine reads no flags and no environment of its own.
type Options struct {
	RunID         string
	EngineVersion string

	// Secrets maps the name of a ${...} reference to its value. The values are
	// used to authenticate and never leave this process.
	Secrets map[string]string

	// Concurrency overrides the plan's. Zero uses the plan's.
	Concurrency int

	// HostConcurrency overrides the plan's cap on simultaneous connection
	// openings against one destination machine. Zero uses the plan's.
	HostConcurrency int

	// Dial is the dialer. Nil means SSHDialer.
	Dial Dialer

	// OnStudentDone is called after each student with the artifact as it
	// stands, so the caller can keep a partial file on disk. An error it
	// returns becomes a warning: it must not be silent and it must not stop
	// the run.
	OnStudentDone func(run *model.RunResult) error
}

// Run evaluates the whole PLAN and returns the artifact. It always returns
// one: a run where every student failed, or one the teacher cancelled, is a
// result and the caller writes it.
//
// Cancellation comes through ctx: the caller wires SIGINT to it. Checks that
// never got to run end as UNEVALUATED with cause CANCELLED.
func Run(ctx context.Context, p *plan.Plan, opts Options) *model.RunResult {
	if opts.Dial == nil {
		opts.Dial = SSHDialer
	}
	concurrency := opts.Concurrency
	if concurrency <= 0 {
		concurrency = p.Summary.Concurrency
	}
	if concurrency <= 0 {
		concurrency = 1
	}
	hostConcurrency := opts.HostConcurrency
	if hostConcurrency <= 0 {
		hostConcurrency = p.Summary.HostConcurrency
	}
	if hostConcurrency <= 0 {
		hostConcurrency = concurrency
	}

	run := &model.RunResult{
		SchemaVersion: model.SchemaVersion,
		RunID:         opts.RunID,
		EngineVersion: opts.EngineVersion,
		StartedAt:     time.Now(),
		Exam:          p.Exam,
		Inventory:     p.Inventory,
		PlanHash:      p.Hash,
		Plan:          p.Summary,
		Students:      make([]model.StudentResult, len(p.Students)),
	}
	run.Plan.Concurrency = concurrency
	run.Plan.HostConcurrency = hostConcurrency

	r := &runner{
		plan:        p,
		opts:        opts,
		concurrency: concurrency,
		gate:        newHostGate(hostConcurrency),
		keys:        ssh.NewHostKeys(),
	}
	r.evaluate(ctx, run)

	run.FinishedAt = time.Now()
	if ctx.Err() != nil {
		run.Status = model.RunCancelled
	} else {
		run.Status = model.RunStatusOf(run.Students)
	}
	return run
}

// ExitCode is the process status for an artifact. The codes are discriminant
// on purpose: a partial run is 3 and never 1, so a script can tell it apart
// from the engine itself blowing up.
func ExitCode(run *model.RunResult) int {
	switch run.Status {
	case model.RunCancelled:
		return 4
	case model.RunComplete:
		return 0
	default:
		return 3
	}
}

type runner struct {
	plan        *plan.Plan
	opts        Options
	concurrency int

	// gate bounds the simultaneous connection openings against one machine,
	// shared by every worker: without it the pool itself produces zeros.
	gate *hostGate

	// keys is the identity every machine presented in this run, shared by
	// every student: a machine that changes identity halfway through is not
	// the machine that was being examined (ADR-0011).
	keys *ssh.HostKeys

	mu  sync.Mutex // guards the artifact while the workers fill it
	run *model.RunResult
}

// evaluate runs the students through a bounded pool, one student per worker.
// The artifact keeps the PLAN's order whatever order they finish in.
func (r *runner) evaluate(ctx context.Context, run *model.RunResult) {
	r.run = run

	jobs := make(chan int)
	var wg sync.WaitGroup
	for w := 0; w < r.concurrency; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range jobs {
				result := r.evalStudent(ctx, r.plan.Students[i])
				r.publish(i, result)
			}
		}()
	}

	for i := range r.plan.Students {
		jobs <- i
	}
	close(jobs)
	wg.Wait()
}

// publish stores one student's result and lets the caller persist the
// partial. Students not evaluated yet are still in the artifact as zero
// values; the caller writes what there is, which is the point of a partial.
func (r *runner) publish(i int, result model.StudentResult) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.run.Students[i] = result
	if r.opts.OnStudentDone == nil {
		return
	}
	if err := r.opts.OnStudentDone(r.run); err != nil {
		r.run.Warnings = append(r.run.Warnings, model.Warning{
			Scope:   "run",
			Code:    "PARTIAL_WRITE_FAILED",
			Message: fmt.Sprintf("no se ha podido guardar el resultado parcial: %s", oneLine(err)),
		})
	}
}

// warn adds a warning to the artifact from a worker.
func (r *runner) warn(w model.Warning) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.run.Warnings = append(r.run.Warnings, w)
}
