package model

import "testing"

// allCauses is the closed set of ADR-0005. If a cause is ever added, this
// slice must grow with it, and every table below covers it.
var allCauses = []Cause{
	CauseNone,
	CauseConnectFailed,
	CauseAuthFailed,
	CauseTimeout,
	CauseConnectionLost,
	CauseNotRun,
	CauseCancelled,
	CauseEngineError,
}

// okExecution is a complete execution: channel opened, exit status received,
// both streams read. Whatever else a test changes, this is the baseline.
func okExecution(exitCode int) *ExecutionResult {
	return &ExecutionResult{
		Host:            "host1",
		Address:         "127.1.2.3:2201",
		User:            "alumne",
		Transport:       "ssh",
		Command:         []string{"systemctl", "is-active", "kea-dhcp4-server"},
		Completed:       true,
		ExitCode:        &exitCode,
		ConnectAttempts: 1,
		CommandAttempts: 1,
		RemoteProcess:   RemoteFinished,
	}
}

// TestClassifyCauseAlwaysWins is the exhaustive table of acceptance: for every
// one of the seven causes other than NONE the check is UNEVALUATED, no matter
// how healthy the execution and the assertion look. This is invariant 3, and
// it is what keeps a broken machine from reaching the grade.
func TestClassifyCauseAlwaysWins(t *testing.T) {
	for _, cause := range allCauses {
		if cause == CauseNone {
			continue
		}
		t.Run(string(cause), func(t *testing.T) {
			// Deliberately the most favourable evidence possible.
			exec := okExecution(0)
			assertion := &AssertionResult{Kind: "equals", Expected: "active", Found: "active", Matched: true}

			status, gotCause, detail := Classify(exec, assertion, cause)

			if status != Unevaluated {
				t.Errorf("status = %q with cause %q, want UNEVALUATED", status, cause)
			}
			if status == Pass || status == Fail {
				t.Errorf("cause %q produced an academic result; a technical error reached the grade", cause)
			}
			if gotCause != cause {
				t.Errorf("cause = %q, want %q; the cause must not be rewritten", gotCause, cause)
			}
			if detail == "" {
				t.Errorf("detail is empty for cause %q; an UNEVALUATED check must explain itself", cause)
			}
		})
	}
}

// TestClassifyNoneRequiresCompleteEvidence covers the other half: with cause
// NONE, anything short of a complete execution plus an assertion is a bug of
// ours and must surface as ENGINE_ERROR, never as a grade.
func TestClassifyNoneRequiresCompleteEvidence(t *testing.T) {
	matched := &AssertionResult{Kind: "equals", Expected: "active", Found: "active", Matched: true}
	incomplete := okExecution(0)
	incomplete.Completed = false
	noExitCode := okExecution(0)
	noExitCode.ExitCode = nil

	cases := []struct {
		name      string
		exec      *ExecutionResult
		assertion *AssertionResult
	}{
		{"no execution", nil, matched},
		{"execution did not complete", incomplete, matched},
		{"completed without exit code", noExitCode, matched},
		{"no assertion", okExecution(0), nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, cause, detail := Classify(tc.exec, tc.assertion, CauseNone)
			if status != Unevaluated {
				t.Errorf("status = %q, want UNEVALUATED", status)
			}
			if cause != CauseEngineError {
				t.Errorf("cause = %q, want ENGINE_ERROR; our own bugs must be countable", cause)
			}
			if detail == "" {
				t.Error("detail is empty; no error of ours may be silent")
			}
		})
	}
}

// TestClassifyCompleteExecution covers the academic outcomes, including the
// border case that has to stay written down: exit 127 is a FAIL, because the
// student's machine answered and a missing package is part of the exam.
func TestClassifyCompleteExecution(t *testing.T) {
	cases := []struct {
		name       string
		exitCode   int
		matched    bool
		wantStatus AcademicStatus
	}{
		{"assertion holds", 0, true, Pass},
		{"assertion does not hold", 0, false, Fail},
		{"command not found still grades", 127, false, Fail},
		{"non zero exit with matching output", 9, true, Pass},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assertion := &AssertionResult{Kind: "contains", Expected: "x", Matched: tc.matched}
			status, cause, detail := Classify(okExecution(tc.exitCode), assertion, CauseNone)
			if status != tc.wantStatus {
				t.Errorf("status = %q, want %q", status, tc.wantStatus)
			}
			if cause != CauseNone {
				t.Errorf("cause = %q, want NONE on an academic result", cause)
			}
			if detail != "" {
				t.Errorf("detail = %q, want empty on an academic result", detail)
			}
		})
	}
}

// TestClassifyNeverGradesOnAnyCause is the belt-and-braces sweep over the full
// cartesian product: eight causes by every shape of evidence. Not one
// combination with a cause other than NONE may come out PASS or FAIL.
func TestClassifyNeverGradesOnAnyCause(t *testing.T) {
	execs := map[string]*ExecutionResult{"nil": nil, "complete": okExecution(0), "incomplete": {Completed: false}}
	assertions := map[string]*AssertionResult{
		"nil":     nil,
		"matched": {Matched: true},
		"failed":  {Matched: false},
	}

	for _, cause := range allCauses {
		for execName, exec := range execs {
			for assertName, assertion := range assertions {
				status, gotCause, detail := Classify(exec, assertion, cause)

				graded := status == Pass || status == Fail
				if cause != CauseNone && graded {
					t.Errorf("cause=%s exec=%s assertion=%s gave %s: a technical error reached the grade",
						cause, execName, assertName, status)
				}
				if status == Unevaluated {
					if gotCause == CauseNone {
						t.Errorf("cause=%s exec=%s assertion=%s: UNEVALUATED with cause NONE",
							cause, execName, assertName)
					}
					if detail == "" {
						t.Errorf("cause=%s exec=%s assertion=%s: UNEVALUATED with no detail",
							cause, execName, assertName)
					}
				}
				if graded && gotCause != CauseNone {
					t.Errorf("cause=%s exec=%s assertion=%s: %s with cause %s",
						cause, execName, assertName, status, gotCause)
				}
			}
		}
	}
}
