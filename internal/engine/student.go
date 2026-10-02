package engine

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"heimdall/internal/assert"
	"heimdall/internal/model"
	"heimdall/internal/plan"
	"heimdall/internal/ssh"
)

// evalStudent runs every check of one student, in the PLAN's order, reusing
// one session per logical host.
//
// It never returns early: whatever happens, the result carries one
// CheckResult for every check of the PLAN, so the denominator is the same for
// everybody.
func (r *runner) evalStudent(ctx context.Context, sp plan.StudentPlan) model.StudentResult {
	result := model.StudentResult{
		StudentID: sp.ID,
		Name:      sp.Name,
		MoodleID:  sp.MoodleID,
		StartedAt: time.Now(),
	}
	if r.opts.Progress != nil && r.opts.Progress.StudentStart != nil {
		r.opts.Progress.StudentStart(sp.ID, sp.Name)
	}

	if sp.Excluded {
		result.FinishedAt = time.Now()
		result.Status = model.StudentExcluded
		result.Reason = sp.ExcludedReason
		result.Score = model.Score{Total: r.plan.Summary.TotalWeight, Status: model.ScoreExcluded}
		return result
	}

	// Every check starts as "not run": if this student dies at any point, the
	// checks it never reached are already reported, never missing and never
	// FAIL.
	checks := make([]model.CheckResult, len(sp.Checks))
	for i, c := range sp.Checks {
		checks[i] = skeleton(c, model.CauseNotRun,
			"el motor no llegó a ejecutar la comprobación")
	}

	// The budget is the student's alone: when it runs out, that student's
	// remaining checks are NOT_RUN and nobody else notices.
	studentCtx, cancel := withBudget(ctx, r.plan.StudentBudget)
	defer cancel()

	r.runChecks(ctx, studentCtx, sp, checks)

	result.FinishedAt = time.Now()
	result.Checks = checks
	result.Status = model.StudentStatusOf(checks)
	result.Score = model.ComputeScore(r.plan.Summary, checks)
	return result
}

// withBudget bounds a student's context by the run-wide student budget. A
// budget of zero means no bound.
func withBudget(ctx context.Context, budget time.Duration) (context.Context, context.CancelFunc) {
	if budget > 0 {
		return context.WithTimeout(ctx, budget)
	}
	return context.WithCancel(ctx)
}

// runChecks fills checks in place. A panic in here is a bug of ours: it is
// caught, it becomes ENGINE_ERROR for the checks this student had left, and
// the rest of the class carries on.
func (r *runner) runChecks(runCtx, studentCtx context.Context, sp plan.StudentPlan, checks []model.CheckResult) {
	done := 0
	hosts := newHostPool(runCtx, r, sp)
	defer hosts.closeAll()

	defer func() {
		p := recover()
		if p == nil {
			return
		}
		detail := fmt.Sprintf("fallo interno del motor evaluando a %s: %s", sp.ID, oneLine(fmt.Errorf("%v", p)))
		for i := done; i < len(checks); i++ {
			checks[i].Status = model.Unevaluated
			checks[i].Cause = model.CauseEngineError
			checks[i].Detail = detail
			r.checkDone(sp.ID, checks[i])
		}
		r.warn(model.Warning{Scope: "student:" + sp.ID, Code: "ENGINE_ERROR", Message: detail})
	}()

	retry := r.opts.Retry
	for i, c := range sp.Checks {
		switch {
		case retry != nil && !retry.Repeat(sp.ID, c.ID):
			// A repeat run only executes what was left unevaluated. This one
			// already had a result last time, so it is not touched and it is
			// not copied either: it stays where it was written (ADR-0018 §5).
			checks[i] = skeleton(c, model.CauseNotRun, notRepeated(retry.at(sp.ID, c.ID)))
		case runCtx.Err() != nil:
			checks[i] = skeleton(c, model.CauseCancelled, "")
		case studentCtx.Err() != nil:
			checks[i] = skeleton(c, model.CauseNotRun, fmt.Sprintf(
				"el alumno %s agotó su presupuesto de %s antes de llegar a esta comprobación",
				sp.ID, r.plan.StudentBudget))
		default:
			checks[i] = r.runCheck(runCtx, studentCtx, sp, hosts, c)
		}
		checks[i].Previous = retry.at(sp.ID, c.ID)
		done = i + 1
		r.checkDone(sp.ID, checks[i])
	}
}

// notRepeated explains, in the artifact of a repeat run, why a check was not
// executed again. Naming what it was last time is what keeps the sentence
// from reading as a second failure of the same check.
func notRepeated(previous *model.PreviousAttempt) string {
	if previous == nil {
		return "no se repitió: esta comprobación no estaba en la corrección anterior"
	}
	switch previous.Status {
	case model.Pass:
		return "no se repitió: en la corrección anterior salió bien"
	case model.Fail:
		return "no se repitió: en la corrección anterior salió mal y un fallo no se vuelve a intentar"
	default:
		return "no se repitió"
	}
}

// runCheck executes one check and classifies it. Everything technical stays
// on the technical side: the only way out of here with PASS or FAIL is a
// complete execution with an assertion that was actually evaluated.
func (r *runner) runCheck(runCtx, studentCtx context.Context, sp plan.StudentPlan, hosts *hostPool, c plan.ResolvedCheck) model.CheckResult {
	spec, err := specOf(c)
	if err != nil {
		return skeleton(c, model.CauseEngineError, err.Error())
	}

	if len(c.Cmd) == 0 {
		return inventoryCheck(c, spec)
	}

	sess, dialErr := hosts.get(studentCtx, c.Host)
	if dialErr != nil {
		return skeleton(c, dialErr.Cause, dialErr.Detail)
	}

	timeout := c.Timeout
	if deadline, ok := studentCtx.Deadline(); ok {
		if left := time.Until(deadline); left > 0 && left < timeout {
			timeout = left
		}
	}

	exec := sess.Run(studentCtx, c.Cmd, timeout)
	cause, detail := causeOf(runCtx, studentCtx, sp, r.plan.StudentBudget, exec, c)

	out := skeleton(c, model.CauseNone, "")
	out.Execution = exec
	if cause == model.CauseNone {
		assertion, err := assert.Eval(*exec, spec)
		if err != nil {
			return failedAssertion(out, err)
		}
		out.Assertion = &assertion
	}

	status, finalCause, fallback := model.Classify(out.Execution, out.Assertion, cause)
	out.Status, out.Cause = status, finalCause
	out.Detail = detail
	if out.Detail == "" {
		out.Detail = fallback
	}
	return out
}

// inventoryTransport is what the artifact records for a check that read its
// value from aula.yaml instead of from a machine (04-MODELO-RESULTADO.md §2).
const inventoryTransport = "inventory"

// inventoryCheck evaluates a check that has no command (M-11): the answer is
// already in aula.yaml and the assertion compares it directly. Nothing is
// executed, here or on any machine, which is the whole point of the
// primitive: the questionnaire used to run the student's answer through a
// shell on the teacher's computer.
//
// It still goes through the four layers. The execution it records is real in
// the only sense that matters for the artifact: it says where the value came
// from, so a PASS can be audited like any other.
func inventoryCheck(c plan.ResolvedCheck, spec assert.Spec) model.CheckResult {
	zero := 0
	exec := &model.ExecutionResult{
		Transport:       inventoryTransport,
		StartedAt:       time.Now(),
		Completed:       true,
		ExitCode:        &zero,
		Stdout:          model.Stream{Text: c.Value, Bytes: int64(len(c.Value)), BytesTotal: int64(len(c.Value))},
		ConnectAttempts: 0,
		CommandAttempts: 0,
		RemoteProcess:   model.RemoteFinished,
	}

	out := skeleton(c, model.CauseNone, "")
	out.Execution = exec
	assertion, err := assert.Eval(*exec, spec)
	if err != nil {
		return failedAssertion(out, err)
	}
	out.Assertion = &assertion

	status, cause, fallback := model.Classify(out.Execution, out.Assertion, model.CauseNone)
	out.Status, out.Cause = status, cause
	if status == model.Unevaluated {
		out.Detail = fallback
	}
	return out
}

// failedAssertion turns a refusal of the assertion layer into an engine
// error. It is never a failed check: the student did not get it wrong, we
// did.
func failedAssertion(out model.CheckResult, err error) model.CheckResult {
	out.Assertion = nil
	out.Status = model.Unevaluated
	out.Cause = model.CauseEngineError
	if errors.Is(err, assert.ErrIncompleteOutput) {
		out.Cause = model.CauseOutputOverflow
	}
	out.Detail = oneLine(err)
	return out
}

// causeOf reads what happened to the process and names the technical cause.
// An execution that completed has none: from there on it is academic.
func causeOf(runCtx, studentCtx context.Context, sp plan.StudentPlan, budget time.Duration, exec *model.ExecutionResult, c plan.ResolvedCheck) (model.Cause, string) {
	if exec.Completed {
		return model.CauseNone, ""
	}
	switch {
	case exec.Overflow:
		// The command was cut off for printing too much. Naming it a lost
		// connection would send the teacher to look at the network.
		return model.CauseOutputOverflow, fmt.Sprintf(
			"el comando de la comprobación %s produjo demasiada salida y se dejó de leer; en el informe está el principio de lo que respondió", c.ID)
	case exec.RemoteProcess == model.RemoteKilledRemote:
		return model.CauseTimeout, fmt.Sprintf(
			"el comando no terminó en %s y se ha matado en la máquina del alumno", c.Timeout)
	case runCtx.Err() != nil:
		return model.CauseCancelled, ""
	case studentCtx.Err() != nil:
		return model.CauseTimeout, fmt.Sprintf(
			"el alumno %s agotó su presupuesto de %s durante esta comprobación", sp.ID, budget)
	case time.Duration(exec.DurationMS)*time.Millisecond >= c.Timeout:
		return model.CauseTimeout, fmt.Sprintf(
			"el comando no terminó en %s y puede haber quedado corriendo en la máquina del alumno", c.Timeout)
	default:
		return model.CauseConnectionLost, ""
	}
}

// skeleton is the check as the artifact reports it when nothing ran: the
// PLAN's identity and weight, an academic status of UNEVALUATED and a reason.
func skeleton(c plan.ResolvedCheck, cause model.Cause, detail string) model.CheckResult {
	status, finalCause, fallback := model.Classify(nil, nil, cause)
	if detail == "" {
		detail = fallback
	}
	return model.CheckResult{
		CheckID:     c.ID,
		Group:       c.Group,
		Description: c.Description,
		Weight:      c.Weight,
		Status:      status,
		Cause:       finalCause,
		Detail:      detail,
	}
}

// specOf names the assertion of a resolved check for the assertion layer.
// An assertion this version does not evaluate is said out loud: turning it
// into a failed check would cost the student marks for a hole of ours.
func specOf(c plan.ResolvedCheck) (assert.Spec, error) {
	switch {
	case c.Contains != nil:
		return assert.Spec{Kind: assert.KindContains, Expected: *c.Contains}, nil
	case c.NotContains != nil:
		return assert.Spec{Kind: assert.KindNotContains, Expected: *c.NotContains}, nil
	case c.Equals != nil:
		return assert.Spec{Kind: assert.KindEquals, Expected: *c.Equals}, nil
	case c.ExitCode != nil:
		return assert.Spec{Kind: assert.KindExitCode, ExitCode: *c.ExitCode}, nil
	case c.Near != nil:
		return assert.Spec{
			Kind:     assert.KindNear,
			Expected: c.Near.Contains,
			Anchor:   c.Near.Anchor,
			Lines:    c.Near.Lines,
		}, nil
	default:
		return assert.Spec{}, fmt.Errorf(
			"la aserción de la comprobación %q todavía no está implementada", c.ID)
	}
}

// hostPool keeps one session per logical host of one student, dialled the
// first time a check needs it and reused afterwards (K-6). A host that
// refused to answer is not dialled again for the same student: the checks
// that needed it all carry the same cause.
type hostPool struct {
	r        *runner
	runCtx   context.Context // the run's own context, to tell cancelled from out of budget
	student  plan.StudentPlan
	sessions map[string]Session
	failures map[string]*ssh.DialError
	targets  map[string]plan.Host
}

func newHostPool(runCtx context.Context, r *runner, sp plan.StudentPlan) *hostPool {
	targets := map[string]plan.Host{}
	for _, c := range sp.Checks {
		if c.Host != "" {
			targets[c.Host] = c.Target
		}
	}
	return &hostPool{
		r:        r,
		runCtx:   runCtx,
		student:  sp,
		sessions: map[string]Session{},
		failures: map[string]*ssh.DialError{},
		targets:  targets,
	}
}

func (h *hostPool) get(ctx context.Context, name string) (Session, *ssh.DialError) {
	if s, ok := h.sessions[name]; ok {
		return s, nil
	}
	if err, ok := h.failures[name]; ok {
		return nil, err
	}

	target := h.targets[name]
	password, err := secretFor(target.PasswordRef, h.r.opts.Secrets)
	if err != nil {
		derr := &ssh.DialError{Cause: model.CauseEngineError, Detail: oneLine(err)}
		h.failures[name] = derr
		return nil, derr
	}

	// Opening the session waits for a turn on that machine: past MaxStartups
	// the server refuses connections, and a refusal of ours would reach the
	// artifact as a check nobody could evaluate.
	endpoint := net.JoinHostPort(target.IP, strconv.Itoa(target.Port))
	if !h.r.gate.acquire(ctx, endpoint) {
		return nil, h.waitCancelled(endpoint)
	}
	sess, derr := h.r.opts.Dial(ctx, ssh.Config{
		Host:           name,
		Address:        target.IP,
		Port:           target.Port,
		User:           target.User,
		Password:       password,
		ConnectTimeout: h.r.plan.ConnectTimeout,
		Keys:           h.r.keys,
	})
	h.r.gate.release(endpoint)
	if derr != nil {
		h.failures[name] = derr
		return nil, derr
	}
	h.sessions[name] = sess
	return sess, nil
}

// waitCancelled names what happened to a check whose turn to connect never
// came: the teacher stopped the run, or this student ran out of budget while
// queueing. Neither is ever an academic failure, and neither is remembered as
// a failed host: the machine was never asked anything.
func (h *hostPool) waitCancelled(endpoint string) *ssh.DialError {
	if h.runCtx.Err() != nil {
		return &ssh.DialError{Cause: model.CauseCancelled, Detail: ""}
	}
	return &ssh.DialError{
		Cause: model.CauseTimeout,
		Detail: fmt.Sprintf(
			"el alumno %s agotó su presupuesto de %s esperando turno para conectar con %s",
			h.student.ID, h.r.plan.StudentBudget, endpoint),
	}
}

// closeAll ends the student's sessions and moves their warnings into the
// artifact, tagged with the student they belong to.
func (h *hostPool) closeAll() {
	for name, s := range h.sessions {
		for _, w := range s.Warnings() {
			w.Scope = "student:" + h.student.ID + "/" + w.Scope
			h.r.warn(w)
		}
		_ = s.Close()
		delete(h.sessions, name)
	}
}

// secretFor resolves a ${NOMBRE} reference from the inventory. A reference
// with no value defined is an error and never an empty password: trying to
// log in with "" would lock accounts and report a wrong cause.
func secretFor(ref string, secrets map[string]string) (string, error) {
	if ref == "" {
		return "", nil
	}
	name := strings.TrimSuffix(strings.TrimPrefix(ref, "${"), "}")
	if name == ref {
		return "", fmt.Errorf("password_ref %q no es una referencia como ${AULA_PASSWORD}", ref)
	}
	value, ok := secrets[name]
	if !ok {
		return "", fmt.Errorf("no se ha definido ningún valor para ${%s}", name)
	}
	return value, nil
}

// CheckSecrets reports the references the PLAN needs and the run does not
// have. The CLI calls it before opening the first connection, so a missing
// password is a configuration error (exit 2) and not a class full of
// UNEVALUATED.
func CheckSecrets(p *plan.Plan, secrets map[string]string) error {
	var missing []string
	seen := map[string]bool{}
	for _, sp := range p.Students {
		if sp.Excluded {
			continue
		}
		for _, c := range sp.Checks {
			ref := c.Target.PasswordRef
			if ref == "" || seen[ref] {
				continue
			}
			seen[ref] = true
			if _, err := secretFor(ref, secrets); err != nil {
				missing = append(missing, oneLine(err))
			}
		}
	}
	if len(missing) == 0 {
		return nil
	}
	return fmt.Errorf("%s", strings.Join(missing, "\n"))
}

func oneLine(err error) string {
	if err == nil {
		return ""
	}
	return strings.TrimSpace(strings.ReplaceAll(err.Error(), "\n", " "))
}
