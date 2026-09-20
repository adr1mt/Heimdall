package main

// The command line the current GUI drives. It is a temporary layer, like
// internal/legacy: it exists so the GUI can launch this engine, recognise it
// and follow the run without changing a line, and it goes away when the GUI
// reads the canonical artifact. Nothing here touches a grade.

import (
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"heimdall/internal/model"
	"heimdall/internal/plan"
)

// legacyVersion is the Teuton version the GUI was written against. It is
// printed so the GUI's check (/version\s+([\d.]+)/i) recognises the binary,
// with the real engine version alongside so nobody is fooled by the line.
const legacyVersion = "2.10.6"

func printVersion(w io.Writer) {
	fmt.Fprintf(w, "teuton version %s (heimdall %s)\n", legacyVersion, version)
}

// printDSLStats prints the table the GUI reads to know how many checks each
// student has, which is what makes its progress bar exact. The number comes
// from the resolved PLAN, so it is the same number the run will produce.
func printDSLStats(w io.Writer, p *plan.Plan) {
	groups := map[string]bool{}
	for _, s := range p.Students {
		for _, c := range s.Checks {
			groups[c.Group] = true
		}
	}
	rows := [][2]string{
		{"Groups", strconv.Itoa(len(groups))},
		{"Targets", strconv.Itoa(p.Summary.CheckCount)},
		{"Cases", strconv.Itoa(len(p.Students))},
	}
	const sep = "+--------------+-------+"
	fmt.Fprintln(w, sep)
	fmt.Fprintf(w, "| %-12s | %-5s |\n", "DSL Stats", "Count")
	fmt.Fprintln(w, sep)
	for _, r := range rows {
		fmt.Fprintf(w, "| %-12s | %-5s |\n", r[0], r[1])
	}
	fmt.Fprintln(w, sep)
}

// selectCases keeps only the students the GUI asked for with --case=1,3. The
// positions are the ones of the inventory, counting from one, and they change
// who is evaluated, never what is evaluated: the checks, the weights and the
// denominator are the PLAN's and stay untouched.
func selectCases(p *plan.Plan, spec string) error {
	if strings.TrimSpace(spec) == "" {
		return nil
	}
	wanted := map[int]bool{}
	for _, field := range strings.Split(spec, ",") {
		field = strings.TrimSpace(field)
		n, err := strconv.Atoi(field)
		if err != nil || n < 1 || n > len(p.Students) {
			return fmt.Errorf("--case=%s: %q no es una posición de alumno entre 1 y %d",
				spec, field, len(p.Students))
		}
		wanted[n] = true
	}
	positions := make([]int, 0, len(wanted))
	for n := range wanted {
		positions = append(positions, n)
	}
	sort.Ints(positions)

	kept := make([]plan.StudentPlan, 0, len(positions))
	for _, n := range positions {
		kept = append(kept, p.Students[n-1])
	}
	p.Students = kept
	return nil
}

// progress writes the live progress the GUI parses: one character per check
// between "Started at" and "Finished in". A student who was excluded emits a
// single "S", as a skipped case did in the old engine.
//
// The characters of a student are written when that student finishes, which
// is the finest grain the engine reports today. The GUI only counts them, so
// the bar is exact either way.
type progress struct {
	w        io.Writer
	reported map[string]bool
	start    time.Time
}

func newProgress(w io.Writer) *progress {
	p := &progress{w: w, reported: map[string]bool{}, start: time.Now()}
	fmt.Fprintf(w, "Started at %s\n", p.start.Format("2006-01-02 15:04:05 -0700"))
	return p
}

// students writes the symbols of every student finished since the last call.
// Students finish out of order and their slots stay empty until they do, so
// the slot is read by its id and never by its position.
func (p *progress) students(run *model.RunResult) {
	var b strings.Builder
	for _, s := range run.Students {
		if s.StudentID == "" || p.reported[s.StudentID] {
			continue
		}
		p.reported[s.StudentID] = true
		if s.Status == model.StudentExcluded {
			b.WriteByte('S')
			continue
		}
		for _, c := range s.Checks {
			if c.Status == model.Pass {
				b.WriteByte('.')
			} else {
				b.WriteByte('F')
			}
		}
	}
	if b.Len() > 0 {
		fmt.Fprint(p.w, b.String())
	}
}

func (p *progress) finish() {
	fmt.Fprintf(p.w, "\nFinished in %.2f seconds\n", time.Since(p.start).Seconds())
}

// legacyExitCode translates our exit codes into the ones the GUI knows.
//
// The GUI discards the reports of any run that does not end with 0
// (renderer/lib/run.ts:446), and a partial run —a student with the machine
// off— is the ordinary case of an exam, which the old engine also ended with
// 0. So under --export=json a partial run exits 0 and the partial state
// travels where the GUI actually reads it: the reports. Invalid configuration
// and cancellation keep their codes; there is nothing to read in either case.
func legacyExitCode(code int) int {
	if code == exitPartial {
		return exitOK
	}
	return code
}
