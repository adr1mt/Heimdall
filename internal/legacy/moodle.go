package legacy

import (
	"fmt"
	"strings"

	"heimdall/internal/model"
)

// moodleCSV is var/<testname>/moodle.csv (C8), which the GUI hands over as it
// is and the teacher uploads to Moodle. Only the students that have a Moodle
// id appear: a row without one is useless to Moodle.
//
// The feedback column is always quoted, as Teuton's was, because that is the
// shape the teacher's Moodle import already accepts.
func moodleCSV(run *model.RunResult) []byte {
	var b strings.Builder
	b.WriteString("MoodleID,TeutonGrade,TeutonFeedback\n")
	for i, s := range run.Students {
		if s.MoodleID == "" {
			continue
		}
		feedback := fmt.Sprintf("Filename: case-%s. Date: %s", caseID(i), formatTime(run.FinishedAt))
		fmt.Fprintf(&b, "%s,%.1f,%s\n",
			field(defuse(s.MoodleID)), legacyGrade(s.Score), quote(defuse(feedback)))
	}
	return []byte(b.String())
}

// field quotes only when the value would otherwise break the row.
func field(s string) string {
	if strings.ContainsAny(s, ",\"\n\r") {
		return quote(s)
	}
	return s
}

func quote(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

// defuse stops a spreadsheet from reading a cell as a formula (F-14). The
// student's data reaches this file, and it is untrusted.
func defuse(s string) string {
	if s == "" {
		return s
	}
	if strings.ContainsAny(s[:1], "=+-@\t\r") {
		return "'" + s
	}
	return s
}
