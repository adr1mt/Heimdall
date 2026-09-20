// Package events writes the native contract between the engine and the GUI:
// one JSON object per line on stdout, as the run happens.
//
// The contract is the only channel the GUI has, together with the canonical
// artifact it points at (ADR-0016, ADR-0017). It is deliberately thin: it
// carries progress and status, never output from a student's machine. What
// happened is in the artifact; what is happening is here.
//
// Two rules hold it up. Nothing here is ever a source of truth the artifact
// does not have, so a consumer that misses an event loses progress and never
// a grade. And nothing here grows without bound: the student's output is
// untrusted data and it does not travel on this channel at all.
//
// Field names are English: this is a machine contract. The format is
// documented in docs/design/09-CONTRATO-GUI.md.
package events

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"heimdall/internal/model"
)

// ContractVersion is the version of the event stream. It travels on the first
// line: a consumer that does not know it must say so and stop, not guess.
//
// It goes up only when an existing field changes meaning or disappears.
// Adding a field does not move it, so a consumer must ignore what it does not
// know.
const ContractVersion = 1

// redacted replaces a secret value that somehow reached a message. Same text
// as report.Redacted; the two defences are independent on purpose.
const redacted = "[oculto]"

// Meta is the envelope every event carries. Seq is monotonic and starts at 1,
// so a consumer can tell a dropped line from a slow one.
type Meta struct {
	Event string    `json:"event"`
	Seq   int       `json:"seq"`
	TS    time.Time `json:"ts"`
}

// StudentRef names a student before anything has been evaluated, so the GUI
// can draw the whole class at once.
type StudentRef struct {
	StudentID string `json:"student_id"`
	Name      string `json:"name"`
	MoodleID  string `json:"moodle_id,omitempty"`
	Excluded  bool   `json:"excluded"`
}

// RunStart is the first line. It fixes what the run will do before a single
// machine is contacted: the same checks, the same weights and the same
// denominator for everybody (ADR-0002, ADR-0004).
type RunStart struct {
	Meta
	ContractVersion int             `json:"contract_version"`
	RunID           string          `json:"run_id"`
	EngineVersion   string          `json:"engine_version"`
	Exam            model.SourceRef `json:"exam"`
	Inventory       model.SourceRef `json:"inventory"`
	PlanHash        string          `json:"plan_hash"`

	// Plan is the PLAN summary, check_count included: that is the
	// denominator, and it does not move.
	Plan model.PlanSummary `json:"plan"`

	// ExpectedChecks is how many check.end events this run will emit if
	// nothing goes wrong: check_count times the students that are not
	// excluded. It is the progress bar's total, never the denominator.
	ExpectedChecks int `json:"expected_checks"`

	Students []StudentRef `json:"students"`

	// RetryOf is set when this run repeats the unevaluated checks of an
	// earlier one (ADR-0018), so the screen can say so while it runs and not
	// only when the artifact is opened.
	RetryOf *model.RetryRef `json:"retry_of,omitempty"`
}

// StudentStart says a worker has picked up a student.
type StudentStart struct {
	Meta
	StudentID string `json:"student_id"`
	Name      string `json:"name"`
}

// CheckEnd is one check, finished. It carries the two axes of the model and
// nothing the student's machine printed.
type CheckEnd struct {
	Meta
	StudentID string  `json:"student_id"`
	CheckID   string  `json:"check_id"`
	Group     string  `json:"group,omitempty"`
	Weight    float64 `json:"weight"`

	Status model.AcademicStatus `json:"status"`
	Cause  model.Cause          `json:"cause"`
	Detail string               `json:"detail,omitempty"`

	// DurationMS is the command's own duration, absent when nothing ran.
	DurationMS *int64 `json:"duration_ms"`
}

// StudentEnd carries the student's status and score exactly as the artifact
// will state them. A consumer must read score.status before either number.
type StudentEnd struct {
	Meta
	StudentID string              `json:"student_id"`
	Status    model.StudentStatus `json:"status"`
	Score     model.Score         `json:"score"`
}

// RunEnd is the last line. A consumer that never sees it must treat the run
// as unfinished, whatever the process did.
type RunEnd struct {
	Meta
	Status   model.RunStatus `json:"status"`
	ExitCode int             `json:"exit_code"`

	// Artifact is the path of the canonical artifact, which is where the
	// result actually lives. Empty only if it could not be written.
	Artifact string `json:"artifact"`

	Counts   Counts          `json:"counts"`
	Warnings []model.Warning `json:"warnings,omitempty"`
}

// Counts is the tally of the run, so a consumer knows what it is looking at
// before it opens the artifact.
type Counts struct {
	Students    int `json:"students"`
	Pass        int `json:"pass"`
	Fail        int `json:"fail"`
	Unevaluated int `json:"unevaluated"`
}

// Emitter writes the stream. It is safe for concurrent use: the engine
// evaluates students in parallel and one line must never land inside another.
type Emitter struct {
	mu      sync.Mutex
	w       io.Writer
	enc     *json.Encoder
	seq     int
	secrets []string
	now     func() time.Time
	err     error
}

// New returns an emitter writing to w. The secrets are the values the run was
// given: the emitter only uses them to recognise them, never to write them.
func New(w io.Writer, secrets []string) *Emitter {
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	kept := make([]string, 0, len(secrets))
	for _, s := range secrets {
		if s != "" {
			kept = append(kept, s)
		}
	}
	return &Emitter{w: w, enc: enc, secrets: kept, now: time.Now}
}

// Err reports the first write that failed. The caller says so on stderr: a
// consumer that stopped reading must not turn into a run that stopped
// reporting.
func (e *Emitter) Err() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.err
}

// RunStart emits the opening line.
func (e *Emitter) RunStart(v RunStart) {
	v.ContractVersion = ContractVersion
	e.emit("run.start", &v.Meta, &v)
}

// StudentStart emits the start of one student.
func (e *Emitter) StudentStart(v StudentStart) { e.emit("student.start", &v.Meta, &v) }

// CheckEnd emits one finished check.
func (e *Emitter) CheckEnd(v CheckEnd) {
	v.Detail = e.scrub(v.Detail)
	e.emit("check.end", &v.Meta, &v)
}

// StudentEnd emits one finished student.
func (e *Emitter) StudentEnd(v StudentEnd) { e.emit("student.end", &v.Meta, &v) }

// RunEnd emits the closing line.
func (e *Emitter) RunEnd(v RunEnd) {
	for i := range v.Warnings {
		v.Warnings[i].Message = e.scrub(v.Warnings[i].Message)
	}
	e.emit("run.end", &v.Meta, &v)
}

// CheckEndOf builds the event of a finished check from the artifact's own
// value, so the stream cannot drift from the file.
func CheckEndOf(studentID string, c model.CheckResult) CheckEnd {
	ev := CheckEnd{
		StudentID: studentID,
		CheckID:   c.CheckID,
		Group:     c.Group,
		Weight:    c.Weight,
		Status:    c.Status,
		Cause:     c.Cause,
		Detail:    c.Detail,
	}
	if c.Execution != nil {
		ms := c.Execution.DurationMS
		ev.DurationMS = &ms
	}
	return ev
}

// CountsOf tallies the checks of an artifact.
func CountsOf(run *model.RunResult) Counts {
	counts := Counts{Students: len(run.Students)}
	for _, s := range run.Students {
		for _, c := range s.Checks {
			switch c.Status {
			case model.Pass:
				counts.Pass++
			case model.Fail:
				counts.Fail++
			default:
				counts.Unevaluated++
			}
		}
	}
	return counts
}

// emit stamps the envelope and writes one line.
func (e *Emitter) emit(name string, meta *Meta, v any) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.seq++
	meta.Event = name
	meta.Seq = e.seq
	meta.TS = e.now()
	if err := e.enc.Encode(v); err != nil && e.err == nil {
		e.err = fmt.Errorf("no se pudo escribir el evento %s: %w", name, err)
	}
}

// scrub is the second line of defence, the same one the artifact writer has:
// a secret must be structurally unable to get here, and if one does, it is
// replaced rather than published.
func (e *Emitter) scrub(s string) string {
	for _, secret := range e.secrets {
		s = strings.ReplaceAll(s, secret, redacted)
	}
	return s
}
