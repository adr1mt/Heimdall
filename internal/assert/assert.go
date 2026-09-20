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

	"heimdall/internal/model"
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
	// KindNotContains is `no_contiene`: the forbidden text is nowhere in
	// stdout. It is an anti-check: it passes by absence, which is why it
	// may never be evaluated without a complete execution (K-7).
	KindNotContains Kind = "not_contains"
	// KindNear is `cerca_de`: the expected text appears within the N lines
	// that follow an anchor line. It replaces `grep -A N`.
	KindNear Kind = "near"
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
	// Anchor and Lines are the window of near: the line the anchor appears
	// on plus Lines more. Expected is what must show up inside it.
	Anchor string
	Lines  int
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
	case KindNotContains:
		return evalNotContains(exec.Stdout.Text, spec.Expected), nil
	case KindNear:
		return evalNear(exec.Stdout.Text, spec), nil
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

// evalNotContains passes when the forbidden text is absent. When it is
// present the check fails and the line is reported, because "it is there" is
// the whole finding and the teacher wants to see where.
//
// The refusal of an incomplete execution in Eval is what makes this safe: a
// machine that never answered produces no output, and empty output must never
// be read as "the forbidden text is absent" (K-7).
func evalNotContains(stdout, forbidden string) model.AssertionResult {
	res := model.AssertionResult{Kind: string(KindNotContains), Expected: forbidden}
	i := strings.Index(stdout, forbidden)
	if i < 0 {
		res.Matched = true
		return res
	}
	res.Found = forbidden
	res.Where = "stdout línea " + strconv.Itoa(lineOf(stdout, i))
	return res
}

// evalNear looks for the expected text in the window that starts at a line
// containing the anchor and covers spec.Lines lines more, for every line the
// anchor appears on. That is what `grep -A N` did, minus the shell.
func evalNear(stdout string, spec Spec) model.AssertionResult {
	res := model.AssertionResult{
		Kind:     string(KindNear),
		Expected: fmt.Sprintf("«%s» %s «%s»", spec.Expected, window(spec.Lines), spec.Anchor),
	}
	lines := strings.Split(stdout, "\n")
	anchored := false
	for i, line := range lines {
		if !strings.Contains(line, spec.Anchor) {
			continue
		}
		anchored = true
		end := i + spec.Lines
		if end >= len(lines) {
			end = len(lines) - 1
		}
		for j := i; j <= end; j++ {
			if strings.Contains(lines[j], spec.Expected) {
				res.Matched = true
				res.Found = spec.Expected
				res.Where = fmt.Sprintf("stdout línea %d, con el ancla en la línea %d",
					j+1, i+1)
				return res
			}
		}
	}
	if !anchored {
		res.Where = fmt.Sprintf("el ancla %q no aparece en stdout", spec.Anchor)
	}
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

// window says in words how far the search reaches, because the teacher reads
// this sentence in the report without the exam at hand.
func window(lines int) string {
	switch lines {
	case 0:
		return "en la misma línea que"
	case 1:
		return "en la línea siguiente a"
	default:
		return fmt.Sprintf("en las %d líneas siguientes a", lines)
	}
}

// lineOf returns the 1-based line of byte offset i.
func lineOf(s string, i int) int {
	return 1 + strings.Count(s[:i], "\n")
}
