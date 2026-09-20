// Package assert evaluates the assertion of a check against what the command
// actually produced.
//
// This is layer 2 of the four: it reads an ExecutionResult and produces an
// AssertionResult. It knows nothing about grades, causes or students, and it
// never decides an academic status: the grading layer does that.
package assert

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"evalon/internal/model"
)

// Kind is the assertion the teacher wrote, named as it appears in the
// artifact. The Spanish keys of examen.yaml are mapped to these by the caller.
type Kind string

const (
	// KindContains is `contiene`: the expected text appears in stdout.
	KindContains Kind = "contains"
	// KindEquals is `igual_a`: stdout, trimmed of surrounding blanks, is the
	// expected text.
	KindEquals Kind = "equals"
	// KindExitCode is `exit_code`: the process ended with that status.
	KindExitCode Kind = "exit_code"
)

// Spec is the assertion of one resolved check: the kind and the expected
// value, already substituted. It is deliberately not plan.ResolvedCheck:
// this package must not depend on how the exam is written.
type Spec struct {
	Kind Kind
	// Expected is the text for contains and equals.
	Expected string
	// ExitCode is the status for exit_code.
	ExitCode int
}

// ErrNotCompleted is returned when Eval is asked to compare an execution that
// never finished. There is nothing trustworthy to compare: the check is
// UNEVALUATED with its technical cause, and no assertion is recorded at all.
var ErrNotCompleted = errors.New("assert: la ejecución no se completó, no hay nada que comparar")

// ErrUnknownKind is returned for an assertion this package does not evaluate.
// Silently treating it as "not matched" would turn a hole in the engine into
// a student's failed check.
var ErrUnknownKind = errors.New("assert: tipo de aserción no soportado")

// Eval compares exec against spec.
//
// It refuses an execution that did not complete: with no exit status, or with
// a stream cut short, stdout is not evidence of anything. The caller must
// have classified such a check as UNEVALUATED before getting here.
func Eval(exec model.ExecutionResult, spec Spec) (model.AssertionResult, error) {
	if !exec.Completed {
		return model.AssertionResult{}, ErrNotCompleted
	}

	switch spec.Kind {
	case KindContains:
		return evalContains(exec.Stdout.Text, spec.Expected), nil
	case KindEquals:
		return evalEquals(exec.Stdout.Text, spec.Expected), nil
	case KindExitCode:
		return evalExitCode(exec.ExitCode, spec.ExitCode)
	default:
		return model.AssertionResult{}, fmt.Errorf("%w: %q", ErrUnknownKind, spec.Kind)
	}
}

// evalContains looks for the expected text anywhere in stdout and reports the
// line it was found on, so the teacher can go straight to it.
func evalContains(stdout, expected string) model.AssertionResult {
	res := model.AssertionResult{Kind: string(KindContains), Expected: expected}
	i := strings.Index(stdout, expected)
	if i < 0 {
		return res
	}
	res.Matched = true
	res.Found = expected
	res.Where = "stdout línea " + strconv.Itoa(lineOf(stdout, i))
	return res
}

// evalEquals compares the whole of stdout, ignoring the blanks around it and
// the trailing newline, but not the blanks inside it: `a  b` is not `a b`.
func evalEquals(stdout, expected string) model.AssertionResult {
	got := strings.TrimSpace(stdout)
	want := strings.TrimSpace(expected)
	res := model.AssertionResult{Kind: string(KindEquals), Expected: expected}
	if got != want {
		return res
	}
	res.Matched = true
	res.Found = got
	return res
}

// evalExitCode compares the exit status. A completed execution always carries
// one; if it does not, that is a bug of the engine and it is reported as
// such, never as a failed check.
func evalExitCode(got *int, want int) (model.AssertionResult, error) {
	res := model.AssertionResult{Kind: string(KindExitCode), Expected: strconv.Itoa(want)}
	if got == nil {
		return model.AssertionResult{}, errors.New("assert: ejecución completada sin código de salida")
	}
	res.Found = strconv.Itoa(*got)
	res.Matched = *got == want
	return res, nil
}

// lineOf returns the 1-based line of byte offset i.
func lineOf(s string, i int) int {
	return 1 + strings.Count(s[:i], "\n")
}
