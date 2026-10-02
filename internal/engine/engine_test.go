package engine

import (
	"context"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"heimdall/internal/assert"
	"heimdall/internal/model"
	"heimdall/internal/plan"
	"heimdall/internal/ssh"
)

// fakeSession stands in for a machine. Every test says exactly what the
// machine does, so the engine's behaviour is checked without a network.
type fakeSession struct {
	run    func(ctx context.Context, argv []string, timeout time.Duration) *model.ExecutionResult
	warn   []model.Warning
	closed bool
}

func (f *fakeSession) Run(ctx context.Context, argv []string, timeout time.Duration) *model.ExecutionResult {
	return f.run(ctx, argv, timeout)
}
func (f *fakeSession) Warnings() []model.Warning { return f.warn }
func (f *fakeSession) Close() error              { f.closed = true; return nil }

// okExec is a command that finished with status 0 and printed text.
func okExec(text string) *model.ExecutionResult {
	code := 0
	return &model.ExecutionResult{
		Completed:     true,
		ExitCode:      &code,
		RemoteProcess: model.RemoteFinished,
		Stdout:        model.Stream{Text: text, Bytes: int64(len(text)), BytesTotal: int64(len(text))},
	}
}

func testPlan(students ...plan.StudentPlan) *plan.Plan {
	return &plan.Plan{
		ExamName:       "examen de prueba",
		Hash:           "hash",
		ConnectTimeout: time.Second,
		StudentBudget:  time.Minute,
		Students:       students,
		Summary: model.PlanSummary{
			CheckCount:  2,
			TotalWeight: 3,
			CheckIDs:    []string{"c1", "c2"},
			Concurrency: 2,
		},
	}
}

func str(s string) *string { return &s }

// twoChecks is the same pair of checks for every student: same ids, same
// weights, same order. That is the denominator.
func twoChecks() []plan.ResolvedCheck {
	host := plan.Host{IP: "127.1.2.3", Port: 2201, User: "alu", PasswordRef: "${AULA_PASSWORD}"}
	return []plan.ResolvedCheck{
		{ID: "c1", Group: "g", Description: "uno", Weight: 1, Timeout: 5 * time.Second,
			Host: "srv", Target: host, Cmd: []string{"echo", "uno"}, Contains: str("uno")},
		{ID: "c2", Group: "g", Description: "dos", Weight: 2, Timeout: 5 * time.Second,
			Host: "srv", Target: host, Cmd: []string{"echo", "dos"}, Contains: str("dos")},
	}
}

func student(id string) plan.StudentPlan {
	return plan.StudentPlan{ID: id, Name: id, Checks: twoChecks()}
}

var secrets = map[string]string{"AULA_PASSWORD": "ficticia"}

// dialFunc builds a dialer that answers per student address/user. The key is
// the student's user, which each test sets apart.
func dialerFor(sessions map[string]Session, failures map[string]*ssh.DialError) (Dialer, *atomic.Int64) {
	var dials atomic.Int64
	return func(ctx context.Context, cfg ssh.Config) (Session, *ssh.DialError) {
		dials.Add(1)
		if err, ok := failures[cfg.User]; ok {
			return nil, err
		}
		return sessions[cfg.User], nil
	}, &dials
}

// withUser returns the student with its host user set, so the fake dialer can
// tell the students apart.
func withUser(sp plan.StudentPlan, user string) plan.StudentPlan {
	for i := range sp.Checks {
		sp.Checks[i].Target.User = user
	}
	return sp
}

func echoSession() Session {
	return &fakeSession{run: func(ctx context.Context, argv []string, _ time.Duration) *model.ExecutionResult {
		return okExec(argv[len(argv)-1])
	}}
}

func find(t *testing.T, run *model.RunResult, id string) model.StudentResult {
	t.Helper()
	for _, s := range run.Students {
		if s.StudentID == id {
			return s
		}
	}
	t.Fatalf("el artefacto no contiene al alumno %q", id)
	return model.StudentResult{}
}

// TestBrokenStudentDoesNotTouchTheOther is principle 4: whatever happens to
// one student, the rest are graded exactly as if they had been alone.
func TestBrokenStudentDoesNotTouchTheOther(t *testing.T) {
	good := withUser(student("alu1"), "alu1")
	broken := withUser(student("alu2"), "roto")

	fail := map[string]*ssh.DialError{"roto": {
		Cause: model.CauseConnectFailed, Detail: "no se ha podido conectar", Attempts: 3,
	}}
	sessions := map[string]Session{"alu1": echoSession()}

	dial, _ := dialerFor(sessions, fail)
	together := Run(context.Background(), testPlan(good, broken), Options{
		RunID: "R1", Secrets: secrets, Dial: dial, Concurrency: 2,
	})

	dialAlone, _ := dialerFor(map[string]Session{"alu1": echoSession()}, nil)
	alone := Run(context.Background(), testPlan(withUser(student("alu1"), "alu1")), Options{
		RunID: "R2", Secrets: secrets, Dial: dialAlone, Concurrency: 2,
	})

	if len(together.Students) != 2 {
		t.Fatalf("el artefacto debe contener a los dos alumnos, tiene %d", len(together.Students))
	}

	a := find(t, together, "alu1")
	b := find(t, alone, "alu1")
	if !reflect.DeepEqual(a.Score, b.Score) {
		t.Errorf("la nota del alumno sano cambia con el roto al lado:\ncon:  %+v\nsin:  %+v", a.Score, b.Score)
	}
	if a.Status != b.Status {
		t.Errorf("estado del alumno sano %q con el roto, %q sin él", a.Status, b.Status)
	}
	for i := range a.Checks {
		x, y := a.Checks[i], b.Checks[i]
		if x.CheckID != y.CheckID || x.Status != y.Status || x.Cause != y.Cause || x.Weight != y.Weight {
			t.Errorf("la comprobación %s del alumno sano cambia: %+v vs %+v", x.CheckID, x, y)
		}
	}
	if a.Status != model.StudentOK || a.Score.Final == nil || *a.Score.Final != 100 {
		t.Errorf("el alumno sano debería tener un 100 completo, tiene %+v", a.Score)
	}

	// The broken one is reported in full, with every check UNEVALUATED and a
	// reason, and with no grade invented.
	r := find(t, together, "alu2")
	if r.Status != model.StudentNotEvaluated {
		t.Errorf("el alumno roto debería ser NOT_EVALUATED, es %q", r.Status)
	}
	if len(r.Checks) != 2 {
		t.Fatalf("el alumno roto debe tener las 2 comprobaciones, tiene %d", len(r.Checks))
	}
	for _, c := range r.Checks {
		if c.Status != model.Unevaluated || c.Cause != model.CauseConnectFailed {
			t.Errorf("comprobación %s: %q/%q, se esperaba UNEVALUATED/CONNECT_FAILED", c.CheckID, c.Status, c.Cause)
		}
		if c.Detail == "" {
			t.Errorf("comprobación %s sin explicación", c.CheckID)
		}
	}
	if r.Score.Final != nil || r.Score.Status != model.ScoreNotEvaluated {
		t.Errorf("el alumno roto no puede tener nota final: %+v", r.Score)
	}
	if together.Status != model.RunPartial {
		t.Errorf("la ejecución debería ser PARTIAL, es %q", together.Status)
	}
	if got := ExitCode(together); got != 3 {
		t.Errorf("exit code %d, se esperaba 3", got)
	}
}

// TestPanicBecomesEngineError: a bug of ours costs that student's checks, is
// visible in the artifact and never aborts the pass.
func TestPanicBecomesEngineError(t *testing.T) {
	boom := &fakeSession{run: func(context.Context, []string, time.Duration) *model.ExecutionResult {
		panic("fallo simulado del motor")
	}}
	dial, _ := dialerFor(map[string]Session{"alu1": echoSession(), "panic": boom}, nil)

	run := Run(context.Background(), testPlan(
		withUser(student("alu1"), "alu1"),
		withUser(student("alu2"), "panic"),
	), Options{RunID: "R", Secrets: secrets, Dial: dial, Concurrency: 2})

	bad := find(t, run, "alu2")
	if len(bad.Checks) != 2 {
		t.Fatalf("el alumno del panic debe tener las 2 comprobaciones, tiene %d", len(bad.Checks))
	}
	for _, c := range bad.Checks {
		if c.Status != model.Unevaluated || c.Cause != model.CauseEngineError {
			t.Errorf("comprobación %s: %q/%q, se esperaba UNEVALUATED/ENGINE_ERROR", c.CheckID, c.Status, c.Cause)
		}
	}
	if len(run.Warnings) == 0 {
		t.Error("un panic no puede ser silencioso: falta el aviso en el artefacto")
	}

	good := find(t, run, "alu1")
	if good.Status != model.StudentOK || good.Score.Final == nil || *good.Score.Final != 100 {
		t.Errorf("el otro alumno debería terminar normal, tiene %q %+v", good.Status, good.Score)
	}
	if got := ExitCode(run); got != 3 {
		t.Errorf("exit code %d, se esperaba 3", got)
	}
}

// TestCancellationLeavesPendingChecksCancelled: SIGINT reaches the engine as
// a cancelled context. What was done stays, what was not is CANCELLED, and
// the artifact is still complete.
func TestCancellationLeavesPendingChecksCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	first := true
	sess := &fakeSession{run: func(ctx context.Context, argv []string, _ time.Duration) *model.ExecutionResult {
		if first {
			first = false
			return okExec("uno")
		}
		cancel()
		return okExec("dos")
	}}
	// The second student never starts: concurrency 1 keeps the order.
	dial, _ := dialerFor(map[string]Session{"alu1": sess, "alu2": echoSession()}, nil)

	run := Run(ctx, testPlan(
		withUser(student("alu1"), "alu1"),
		withUser(student("alu2"), "alu2"),
	), Options{RunID: "R", Secrets: secrets, Dial: dial, Concurrency: 1})

	if run.Status != model.RunCancelled {
		t.Errorf("estado %q, se esperaba CANCELLED", run.Status)
	}
	if got := ExitCode(run); got != 4 {
		t.Errorf("exit code %d, se esperaba 4", got)
	}
	if len(run.Students) != 2 {
		t.Fatalf("el artefacto debe contener a los dos alumnos, tiene %d", len(run.Students))
	}
	pending := find(t, run, "alu2")
	if len(pending.Checks) != 2 {
		t.Fatalf("el alumno pendiente debe tener las 2 comprobaciones, tiene %d", len(pending.Checks))
	}
	for _, c := range pending.Checks {
		if c.Status != model.Unevaluated || c.Cause != model.CauseCancelled {
			t.Errorf("comprobación %s: %q/%q, se esperaba UNEVALUATED/CANCELLED", c.CheckID, c.Status, c.Cause)
		}
	}
	done := find(t, run, "alu1")
	if done.Checks[0].Status != model.Pass {
		t.Errorf("lo que se evaluó antes de parar debe conservarse: %+v", done.Checks[0])
	}
}

// TestBudgetStopsOnlyThatStudent: the checks that never started are NOT_RUN
// with the budget as the reason, and never FAIL.
func TestBudgetStopsOnlyThatStudent(t *testing.T) {
	slow := &fakeSession{run: func(ctx context.Context, argv []string, _ time.Duration) *model.ExecutionResult {
		<-ctx.Done()
		return &model.ExecutionResult{DurationMS: 50, RemoteProcess: model.RemoteUnknown}
	}}
	dial, _ := dialerFor(map[string]Session{"lento": slow, "alu2": echoSession()}, nil)

	p := testPlan(withUser(student("alu1"), "lento"), withUser(student("alu2"), "alu2"))
	p.StudentBudget = 50 * time.Millisecond

	run := Run(context.Background(), p, Options{RunID: "R", Secrets: secrets, Dial: dial, Concurrency: 2})

	stuck := find(t, run, "alu1")
	if stuck.Checks[0].Cause != model.CauseTimeout {
		t.Errorf("la comprobación en curso al agotarse el presupuesto: %q, se esperaba TIMEOUT", stuck.Checks[0].Cause)
	}
	if got := stuck.Checks[1].Cause; got != model.CauseNotRun {
		t.Errorf("la comprobación que no llegó a empezar: %q, se esperaba NOT_RUN", got)
	}
	if stuck.Checks[1].Detail == "" || stuck.Checks[1].Status != model.Unevaluated {
		t.Errorf("la comprobación que no empezó debe ser UNEVALUATED con explicación: %+v", stuck.Checks[1])
	}
	if ok := find(t, run, "alu2"); ok.Status != model.StudentOK {
		t.Errorf("el otro alumno debería terminar normal, está %q", ok.Status)
	}
}

// TestOneSessionPerHost: the session is opened once and reused for every
// check of that student on that host, and closed at the end.
func TestOneSessionPerHost(t *testing.T) {
	sess := &fakeSession{run: func(_ context.Context, argv []string, _ time.Duration) *model.ExecutionResult {
		return okExec(argv[len(argv)-1])
	}}
	dial, dials := dialerFor(map[string]Session{"alu1": sess}, nil)

	Run(context.Background(), testPlan(withUser(student("alu1"), "alu1")),
		Options{RunID: "R", Secrets: secrets, Dial: dial})

	if dials.Load() != 1 {
		t.Errorf("%d conexiones para 2 comprobaciones del mismo host, se esperaba 1", dials.Load())
	}
	if !sess.closed {
		t.Error("la sesión del alumno no se ha cerrado")
	}
}

// TestExcludedStudentIsReportedWithoutGrade.
func TestExcludedStudentIsReportedWithoutGrade(t *testing.T) {
	dial, dials := dialerFor(map[string]Session{"alu1": echoSession()}, nil)
	p := testPlan(withUser(student("alu1"), "alu1"), plan.StudentPlan{ID: "alu2", Name: "alu2", Excluded: true})

	run := Run(context.Background(), p, Options{RunID: "R", Secrets: secrets, Dial: dial})

	ex := find(t, run, "alu2")
	if ex.Status != model.StudentExcluded || ex.Score.Status != model.ScoreExcluded {
		t.Errorf("el alumno excluido: %q/%q", ex.Status, ex.Score.Status)
	}
	if len(ex.Checks) != 0 || ex.Score.Final != nil {
		t.Errorf("un alumno excluido no tiene comprobaciones ni nota: %+v", ex)
	}
	if dials.Load() != 1 {
		t.Errorf("%d conexiones: no se debe conectar con un alumno excluido", dials.Load())
	}
	if run.Status != model.RunComplete || ExitCode(run) != 0 {
		t.Errorf("un excluido no hace parcial la ejecución: %q", run.Status)
	}
}

// TestMissingSecretIsNotAnEmptyPassword: a reference without a value never
// becomes a login attempt with "".
func TestMissingSecretIsNotAnEmptyPassword(t *testing.T) {
	dial, dials := dialerFor(map[string]Session{"alu1": echoSession()}, nil)
	run := Run(context.Background(), testPlan(withUser(student("alu1"), "alu1")),
		Options{RunID: "R", Secrets: map[string]string{}, Dial: dial})

	if dials.Load() != 0 {
		t.Errorf("%d conexiones con la contraseña sin definir, se esperaba 0", dials.Load())
	}
	c := find(t, run, "alu1").Checks[0]
	if c.Cause != model.CauseEngineError || c.Detail == "" {
		t.Errorf("comprobación sin secreto: %q/%q", c.Cause, c.Detail)
	}

	if err := CheckSecrets(testPlan(withUser(student("alu1"), "alu1")), map[string]string{}); err == nil {
		t.Error("CheckSecrets debería detectar la referencia sin valor antes de conectar")
	}
	if err := CheckSecrets(testPlan(withUser(student("alu1"), "alu1")), secrets); err != nil {
		t.Errorf("CheckSecrets con el secreto definido: %v", err)
	}
}

// TestFailedCheckIsAcademic: a command that runs and does not match is FAIL,
// with no technical cause, and it counts in the denominator.
func TestFailedCheckIsAcademic(t *testing.T) {
	sess := &fakeSession{run: func(context.Context, []string, time.Duration) *model.ExecutionResult {
		return okExec("otra cosa")
	}}
	dial, _ := dialerFor(map[string]Session{"alu1": sess}, nil)

	run := Run(context.Background(), testPlan(withUser(student("alu1"), "alu1")),
		Options{RunID: "R", Secrets: secrets, Dial: dial})

	s := find(t, run, "alu1")
	for _, c := range s.Checks {
		if c.Status != model.Fail || c.Cause != model.CauseNone {
			t.Errorf("comprobación %s: %q/%q, se esperaba FAIL/NONE", c.CheckID, c.Status, c.Cause)
		}
	}
	if s.Score.Final == nil || *s.Score.Final != 0 || s.Status != model.StudentOK {
		t.Errorf("un examen entero fallado sí tiene nota final 0: %+v", s.Score)
	}
	if ExitCode(run) != 0 {
		t.Errorf("suspender no es una ejecución parcial: exit %d", ExitCode(run))
	}
}

// TestPartialArtifactAfterEachStudent: the caller gets the artifact as it
// grows, so a run that is killed leaves usable evidence.
func TestPartialArtifactAfterEachStudent(t *testing.T) {
	dial, _ := dialerFor(map[string]Session{"alu1": echoSession(), "alu2": echoSession()}, nil)
	calls := 0
	Run(context.Background(), testPlan(withUser(student("alu1"), "alu1"), withUser(student("alu2"), "alu2")),
		Options{RunID: "R", Secrets: secrets, Dial: dial, Concurrency: 1,
			OnStudentDone: func(*model.RunResult) error { calls++; return nil }})
	if calls != 2 {
		t.Errorf("%d parciales para 2 alumnos, se esperaban 2", calls)
	}
}

// TestOverflowBeatsALostConnection pins the reason an overflow gets: closing
// the session ourselves looks exactly like a drop from the outside, and the
// teacher would be sent to look at the network instead of at the exam.
func TestOverflowBeatsALostConnection(t *testing.T) {
	exec := &model.ExecutionResult{Completed: false, Overflow: true, DurationMS: 5}
	c := plan.ResolvedCheck{ID: "a6-salida-enorme", Timeout: time.Minute}

	cause, detail := causeOf(context.Background(), context.Background(), plan.StudentPlan{ID: "alumne01"}, time.Minute, exec, c)
	if cause != model.CauseOutputOverflow {
		t.Errorf("causa %q, se esperaba OUTPUT_OVERFLOW", cause)
	}
	if !strings.Contains(detail, "salida") {
		t.Errorf("el motivo no nombra la salida: %q", detail)
	}

	status, gotCause, _ := model.Classify(exec, nil, cause)
	if status != model.Unevaluated {
		t.Errorf("estado %q: una salida desbordada nunca es un suspenso", status)
	}
	if gotCause != model.CauseOutputOverflow {
		t.Errorf("la causa se pierde por el camino: %q", gotCause)
	}
}

func TestTruncatedAssertionHasTechnicalCause(t *testing.T) {
	out := failedAssertion(model.CheckResult{Weight: 1}, assert.ErrIncompleteOutput)
	if out.Status != model.Unevaluated || out.Cause != model.CauseOutputOverflow || out.Assertion != nil {
		t.Fatalf("%+v", out)
	}
}
