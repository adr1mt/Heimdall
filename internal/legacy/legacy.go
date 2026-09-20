// Package legacy writes the three files Teuton 2.10.6 used to leave in
// var/<testname>/, so the existing GUI works against this engine without a
// single change (C6, C7 and C8 of docs/research/GUI-CONTRACT.md).
//
// TEMPORARY LAYER. It only goes one way, from a finished RunResult to disk:
// it never reads a Teuton file, never influences the grade and gets nothing
// added that the GUI's acceptance suite does not demand. The whole package
// disappears the day the GUI reads the canonical artifact.
//
// See docs/design/06-LEGACY-WRITER.md.
package legacy

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"

	"heimdall/internal/model"
	"heimdall/internal/report"
)

// timeLayout is how Teuton printed a timestamp: "2026-09-16 20:45:36 +0200".
const timeLayout = "2006-01-02 15:04:05 -0700"

// The sentinels Teuton wrote into `output` and `result` when it could not run
// a command. The GUI shows them and its e2e suite looks for them.
const (
	sentinelSSH      = "TEUTON_ERROR_SSH"
	sentinelAuth     = "TEUTON_ERROR_SSH_AUTH_FAILED"
	sentinelNoConn   = "TEUTON_ERROR_SSH_NO_CONNECTION"
	labelAuthFailed  = "error_authentication_failed"
	labelUnreachable = "host_unreachable"
	labelError       = "error"
	// unknownHost keys conn_status when the check never got as far as
	// knowing which machine it was going to talk to.
	unknownHost = "desconocido"
)

// Writer writes the legacy files of one run into dir, which is
// var/<testname>/ as main/results.ts of the GUI expects (C5).
type Writer struct {
	dir      string
	testName string
}

// New returns a writer for testName under varDir, creating the directory.
func New(varDir, testName string) (*Writer, error) {
	dir := filepath.Join(varDir, testName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("legacy: no se pudo crear %s: %w", dir, err)
	}
	return &Writer{dir: dir, testName: testName}, nil
}

// Dir is where the legacy files are written.
func (w *Writer) Dir() string { return w.dir }

// Write projects run onto resume.json, one case-NN.json per student and
// moodle.csv. Every file is written atomically, like the canonical artifact.
func (w *Writer) Write(run *model.RunResult) error {
	if err := w.writeJSON("resume.json", w.resume(run)); err != nil {
		return err
	}
	for i, student := range run.Students {
		id := caseID(i)
		if err := w.writeJSON("case-"+id+".json", w.caseReport(run, student, id)); err != nil {
			return err
		}
	}
	return report.WriteAtomic(filepath.Join(w.dir, "moodle.csv"), moodleCSV(run))
}

func (w *Writer) writeJSON(name string, v any) error {
	data, err := model.MarshalCanonical(v)
	if err != nil {
		return fmt.Errorf("legacy: no se pudo serializar %s: %w", name, err)
	}
	return report.WriteAtomic(filepath.Join(w.dir, name), data)
}

// caseID is the 1-based, two digit index Teuton used as a case name.
func caseID(i int) string { return fmt.Sprintf("%02d", i+1) }

// legacyGrade translates a canonical score into the single number the GUI
// reads. An INCOMPLETE deliberately becomes 0 and not its provisional score:
// the GUI infers "not evaluated" from `connErrors > 0 && grade === 0`, so a 0
// with a conn_status is the only thing that stops it from publishing an
// incomplete grade as if it were final. It is ugly, it is on purpose, and it
// goes away with this layer (design/06 §3).
func legacyGrade(s model.Score) float64 {
	if s.Status == model.ScoreComplete && s.Final != nil {
		return float64(*s.Final)
	}
	return 0
}

// letter is the one character mark the GUI shows next to the grade.
func letter(skip bool, grade float64) string {
	switch {
	case skip:
		return "S"
	case grade >= 100:
		return "✓"
	case grade <= 0:
		return "✗"
	default:
		return "?"
	}
}

// causeRank orders the causes of one host so that conn_status carries the one
// the teacher has to act on first. A student whose machine rejected the
// password and later timed out is an authentication problem.
func causeRank(c model.Cause) int {
	switch c {
	case model.CauseAuthFailed:
		return 3
	case model.CauseConnectFailed:
		return 2
	default:
		return 1
	}
}

func causeLabel(c model.Cause) string {
	switch c {
	case model.CauseAuthFailed:
		return labelAuthFailed
	case model.CauseConnectFailed:
		return labelUnreachable
	default:
		return labelError
	}
}

// connStatus is one label per host that had trouble, with the dominant cause.
// The legacy format has no room for a cause per check, so this is all the
// technical detail that survives the conversion.
func connStatus(s model.StudentResult) map[string]string {
	worst := map[string]model.Cause{}
	for _, c := range s.Checks {
		if c.Cause == model.CauseNone {
			continue
		}
		host := unknownHost
		if c.Execution != nil && c.Execution.Host != "" {
			host = c.Execution.Host
		}
		if seen, ok := worst[host]; !ok || causeRank(c.Cause) > causeRank(seen) {
			worst[host] = c.Cause
		}
	}
	out := make(map[string]string, len(worst))
	for host, cause := range worst {
		out[host] = causeLabel(cause)
	}
	// A student the GUI must not read as a plain zero always leaves a label:
	// without it, "machine off" and "did nothing" look the same (design/06 §5).
	if len(out) == 0 && needsConnStatus(s.Score.Status) {
		out[unknownHost] = labelError
	}
	return out
}

func needsConnStatus(s model.ScoreStatus) bool {
	return s == model.ScoreIncomplete || s == model.ScoreNotEvaluated
}

// sentinel is what Teuton put in `output` and `result` for a check it could
// not run. UNEVALUATED has no legacy equivalent: this is what is left of it.
func sentinel(c model.CheckResult) string {
	switch c.Cause {
	case model.CauseAuthFailed:
		return sentinelAuth
	case model.CauseNotRun, model.CauseCancelled:
		return sentinelNoConn
	default:
		return sentinelSSH
	}
}

// round2 keeps the durations readable, as Teuton's were.
func round2(seconds float64) float64 {
	return math.Round(seconds*1000) / 1000
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(timeLayout)
}

// firstLine is the legacy `output`: Teuton only had room for one line.
func firstLine(text string) string {
	trimmed := strings.TrimRight(text, "\n")
	if trimmed == "" {
		return ""
	}
	lines := strings.Split(trimmed, "\n")
	if len(lines) == 1 {
		return lines[0]
	}
	return fmt.Sprintf("(%d lines)", len(lines))
}
