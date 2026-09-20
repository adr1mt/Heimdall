// Package model holds the canonical result types of the engine and the pure
// functions that compute a grade from them.
//
// The four layers are strictly separated and each one may only read the
// previous one: ExecutionResult -> AssertionResult -> CheckResult -> Score.
// A technical error has no path to the grade because Score only ever looks at
// CheckResult.Status and CheckResult.Weight.
//
// Field names are English: this is a machine contract consumed by the GUI and
// by the tests. See docs/design/04-MODELO-RESULTADO.md and ADR-0007.
package model

import (
	"bytes"
	"encoding/json"
	"time"
)

// SchemaVersion is the version of the canonical artifact this package writes.
const SchemaVersion = 1

// RunResult is the complete artifact of one run. It is written once,
// atomically, and never modified.
type RunResult struct {
	SchemaVersion int    `json:"schema_version"`
	RunID         string `json:"run_id"` // ULID, time sortable
	EngineVersion string `json:"engine_version"`

	StartedAt  time.Time `json:"started_at"` // RFC3339 with zone
	FinishedAt time.Time `json:"finished_at"`
	Status     RunStatus `json:"status"`

	Exam      SourceRef `json:"exam"`
	Inventory SourceRef `json:"inventory"`
	PlanHash  string    `json:"plan_hash"` // sha256 of the resolved PLAN

	Plan     PlanSummary     `json:"plan"`
	Students []StudentResult `json:"students"`
	Warnings []Warning       `json:"warnings,omitempty"`
}

// SourceRef identifies an input file as it stood when the run started.
type SourceRef struct {
	Path    string `json:"path"`
	SHA256  string `json:"sha256"`
	Version string `json:"version,omitempty"` // the YAML `version:` key
}

// PlanSummary is what the PLAN fixed before any machine was contacted. It is
// identical for every student: that is what makes the denominator fair.
type PlanSummary struct {
	CheckCount  int      `json:"check_count"`
	TotalWeight float64  `json:"total_weight"`
	CheckIDs    []string `json:"check_ids"` // in order

	// Concurrency is how many students were evaluated at once and
	// HostConcurrency how many sessions were opened at once against one
	// destination machine. Both are published so the artifact says under
	// which conditions the run happened.
	Concurrency     int `json:"concurrency"`
	HostConcurrency int `json:"host_concurrency"`
}

// StudentResult is everything the run found out about one student.
type StudentResult struct {
	StudentID string        `json:"student_id"`
	Name      string        `json:"name"`
	MoodleID  string        `json:"moodle_id,omitempty"`
	Status    StudentStatus `json:"status"`

	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at"`

	Score  Score         `json:"score"`
	Checks []CheckResult `json:"checks"`
}

// Score is the grade layer: five numbers and a status. The engine publishes
// 0-100 integers and the raw numbers; converting to the teacher's scale is the
// GUI's job.
type Score struct {
	Obtained    float64 `json:"obtained"`    // weight of the PASS checks
	Evaluable   float64 `json:"evaluable"`   // weight of PASS + FAIL
	Total       float64 `json:"total"`       // total weight of the PLAN
	Unevaluated float64 `json:"unevaluated"` // total - evaluable

	// Provisional is round(100*obtained/evaluable), null when evaluable is 0.
	Provisional *int `json:"provisional_score"`
	// Final is round(100*obtained/total), null while a single UNEVALUATED
	// check of weight > 0 exists. Never a 0 standing in for "we could not look".
	Final *int `json:"final_score"`

	Status ScoreStatus `json:"status"`
}

// CheckResult is the academic layer: one check, for one student.
type CheckResult struct {
	CheckID     string  `json:"check_id"`
	Group       string  `json:"group"`
	Description string  `json:"description"`
	Weight      float64 `json:"weight"`

	Status AcademicStatus `json:"status"`
	Cause  Cause          `json:"cause"`            // NONE when PASS or FAIL
	Detail string         `json:"detail,omitempty"` // one sentence, no stack trace

	// Execution is null when the command was never launched.
	Execution *ExecutionResult `json:"execution"`
	// Assertion is null when there was no complete execution to compare.
	Assertion *AssertionResult `json:"assertion"`
}

// ExecutionResult states the facts about the process. It knows nothing about
// grades.
type ExecutionResult struct {
	Host      string   `json:"host"`
	Address   string   `json:"address"`
	User      string   `json:"user"`
	Transport string   `json:"transport"`
	Command   []string `json:"command"` // argument vector, substituted and sanitised

	StartedAt  time.Time `json:"started_at"`
	DurationMS int64     `json:"duration_ms"`

	// Completed means the exit status was received and both streams were read
	// to EOF. If any of that is missing, the check is UNEVALUATED.
	Completed bool `json:"completed"`
	// ExitCode is null when !Completed.
	ExitCode *int `json:"exit_code"`

	Stdout Stream `json:"stdout"`
	Stderr Stream `json:"stderr"`

	ConnectAttempts int                `json:"connect_attempts"` // 1 means no retry
	CommandAttempts int                `json:"command_attempts"`
	RemoteProcess   RemoteProcessState `json:"remote_process"`
}

// Stream is one captured output stream. The student's output is untrusted
// data: it is capped, and what was dropped is still counted.
type Stream struct {
	Text       string `json:"text"`        // up to the limit, valid UTF-8
	Bytes      int64  `json:"bytes"`       // bytes kept
	BytesTotal int64  `json:"bytes_total"` // bytes the command produced
	Truncated  bool   `json:"truncated"`
}

// AssertionResult states what was compared and what was found. No grade.
type AssertionResult struct {
	Kind     string `json:"kind"`     // contains|equals|not_contains|exit_code|near
	Expected string `json:"expected"` // already substituted
	Found    string `json:"found"`    // the fragment found, or ""
	Matched  bool   `json:"matched"`
	Where    string `json:"where,omitempty"` // "stdout linea 12"
}

// Warning records something the teacher must know that is not a check result.
type Warning struct {
	Scope   string `json:"scope"` // "run" | "student:alumne02" | "check:kea-subnet"
	Code    string `json:"code"`
	Message string `json:"message"`
}

// MarshalCanonical renders v as the canonical JSON encoding of the artifact:
// two-space indentation and no HTML escaping, so that a command containing
// `<`, `>` or `&` reads in the artifact exactly as it was sent to the machine.
func MarshalCanonical(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
