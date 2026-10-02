package model

import "math"

// This file holds the two pure functions that stand between a broken machine
// and a student's grade, plus the two derived statuses.
//
// Nothing here touches the network, the disk, the clock or the environment.
// That is not a style preference: it is what makes the grade reproducible and
// testable. See .claude/rules/architecture.md and ARCHITECTURE.md section 7.

// weightEpsilon is the slack used when comparing accumulated weights against
// zero. Weights are teacher-written decimals, so a plan of 0.1 + 0.2 + 0.7
// leaves a residue around 1e-16 in total-evaluable. Without this, that residue
// would read as "something is still unevaluated" and would deny a final grade
// to a student who earned one. This slack only removes arithmetic residue
// when no positive-weight check is pending; real weights may be smaller.
const weightEpsilon = 1e-9

// isZeroWeight reports whether an accumulated weight is zero within the slack.
func isZeroWeight(w float64) bool { return math.Abs(w) < weightEpsilon }

// Classify turns the technical layers into the academic one. It is the only
// place where a check becomes PASS or FAIL, and it is deliberately hard to get
// there: the cause must be NONE, the execution must have completed with an
// exit status, and there must be an assertion to compare. Anything else is
// UNEVALUATED.
//
// The returned detail is the fallback sentence for the cause. A caller that
// knows something more specific ("the command did not finish in 20s") replaces
// it; it must never replace it with an empty string, because an UNEVALUATED
// check with no detail leaves the teacher without an explanation.
func Classify(exec *ExecutionResult, assertion *AssertionResult, cause Cause) (AcademicStatus, Cause, string) {
	if cause != CauseNone {
		return Unevaluated, cause, detailFor(cause)
	}

	// From here the caller claims nothing went wrong technically. Every
	// remaining branch is a contradiction of that claim, so it is a bug of
	// ours and says so out loud rather than guessing a grade.
	switch {
	case exec == nil:
		return Unevaluated, CauseEngineError,
			"no se registró ninguna ejecución y tampoco una causa técnica"
	case !exec.Completed:
		return Unevaluated, CauseEngineError,
			"la ejecución no terminó y no se registró la causa técnica"
	case exec.ExitCode == nil:
		return Unevaluated, CauseEngineError,
			"la ejecución se dio por terminada sin código de salida"
	case assertion == nil:
		return Unevaluated, CauseEngineError,
			"la ejecución terminó pero no se evaluó ninguna aserción"
	}

	// A complete execution is an academic result whatever the exit code says.
	// Exit 127 means the command does not exist on the student's machine, and
	// that is part of the exam, not a fault of the engine.
	if assertion.Matched {
		return Pass, CauseNone, ""
	}
	return Fail, CauseNone, ""
}

// detailFor is the fallback sentence for each technical cause, so that an
// UNEVALUATED check is never silent.
func detailFor(cause Cause) string {
	switch cause {
	case CauseConnectFailed:
		return "no se pudo establecer la sesión con la máquina"
	case CauseAuthFailed:
		return "la máquina rechazó las credenciales"
	case CauseTimeout:
		return "el comando no terminó dentro del tiempo límite"
	case CauseConnectionLost:
		return "la sesión se cortó mientras se ejecutaba el comando"
	case CauseOutputOverflow:
		return "el comando produjo demasiada salida y se dejó de leer antes de que terminara; se conserva solo el principio"
	case CauseNotRun:
		return "el motor no llegó a ejecutar la comprobación"
	case CauseCancelled:
		return "la ejecución se paró antes de comprobar esto"
	case CauseEngineError:
		return "fallo interno del motor"
	default:
		// An unknown cause is still a cause: it must not silently become NONE.
		return "causa técnica no reconocida: " + string(cause)
	}
}

// ComputeScore turns the academic layer into numbers. It only ever reads
// Status and Weight: that is why a technical error has no path to the grade.
//
// The denominator comes from the plan, never from the checks received, so a
// student whose run died halfway is still measured against the whole exam.
//
// It never returns EXCLUDED: exclusion is decided from the inventory before
// any check exists, and the caller sets it.
func ComputeScore(plan PlanSummary, checks []CheckResult) Score {
	var obtained, evaluable, pending float64
	for _, c := range checks {
		switch c.Status {
		case Pass:
			obtained += c.Weight
			evaluable += c.Weight
		case Fail:
			evaluable += c.Weight
		case Unevaluated:
			pending += c.Weight
		}
	}

	total := plan.TotalWeight
	unevaluated := total - evaluable
	if pending > 0 {
		unevaluated = pending
	} else if isZeroWeight(unevaluated) {
		unevaluated = 0
	}

	score := Score{
		Obtained:    obtained,
		Evaluable:   evaluable,
		Total:       total,
		Unevaluated: unevaluated,
	}

	if evaluable == 0 {
		// Nothing could be evaluated. This is not a zero: a zero would say the
		// student did nothing, and what happened is that we could not look.
		score.Status = ScoreNotEvaluated
		return score
	}

	score.Provisional = percent(obtained, evaluable)
	if unevaluated > 0 {
		// Rule 1 of the grading policy: while a single check of weight > 0 is
		// unevaluated, there is no final grade. No tolerance threshold.
		score.Status = ScoreIncomplete
		return score
	}

	score.Final = percent(obtained, total)
	score.Status = ScoreComplete
	return score
}

// percent renders part/whole as the 0-100 integer the engine publishes.
// Converting to the teacher's own scale is the GUI's job.
func percent(part, whole float64) *int {
	p := int(math.Round(100 * (part / whole)))
	return &p
}

// StudentStatusOf derives the student's status from their checks. Checks of
// weight 0 are reported but never degrade the status: they are diagnostics,
// not grade.
//
// It never returns EXCLUDED, for the same reason as ComputeScore.
func StudentStatusOf(checks []CheckResult) StudentStatus {
	var counted, unevaluated int
	for _, c := range checks {
		if c.Weight <= 0 {
			continue
		}
		counted++
		if c.Status == Unevaluated {
			unevaluated++
		}
	}

	switch {
	case unevaluated == 0:
		// Also covers a student with no weighted checks at all: nothing broke.
		return StudentOK
	case unevaluated == counted:
		return StudentNotEvaluated
	default:
		return StudentPartial
	}
}

// RunStatusOf derives the status of the whole run from its students. Excluded
// students do not count: they were never going to be evaluated.
//
// It never returns CANCELLED or INVALID_CONFIG: only the engine knows the
// teacher stopped the run, and an invalid PLAN produces no students at all.
func RunStatusOf(students []StudentResult) RunStatus {
	for _, s := range students {
		if s.Status == StudentExcluded {
			continue
		}
		if s.Status != StudentOK {
			return RunPartial
		}
	}
	return RunComplete
}
