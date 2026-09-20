package legacy

import (
	"fmt"
	"strconv"
	"strings"

	"heimdall/internal/model"
)

// caseReport is var/<testname>/case-NN.json (C7): the detail of one student.
type caseReport struct {
	Config  map[string]any `json:"config"`
	Logs    []string       `json:"logs"`
	Groups  []legacyGroup  `json:"groups"`
	Results caseResults    `json:"results"`
}

type legacyGroup struct {
	Title   string         `json:"title"`
	Targets []legacyTarget `json:"targets"`
}

// legacyTarget is one check, flattened. `check` is false for a FAIL and for
// an UNEVALUATED alike: inside this file the two are indistinguishable, and
// that is the worst thing this layer loses (design/06 §5).
type legacyTarget struct {
	TargetID    string  `json:"target_id"`
	Check       bool    `json:"check"`
	Score       float64 `json:"score"`
	Weight      float64 `json:"weight"`
	Description string  `json:"description"`
	ConnType    string  `json:"conn_type"`
	Duration    float64 `json:"duration"`
	Command     string  `json:"command"`
	Output      string  `json:"output"`
	Alterations string  `json:"alterations"`
	Expected    string  `json:"expected"`
	Result      any     `json:"result"`
}

type caseResults struct {
	CaseID      string  `json:"case_id"`
	StartTime   string  `json:"start_time"`
	FinishTime  string  `json:"finish_time"`
	Duration    float64 `json:"duration"`
	UniqueFault int     `json:"unique_fault"`
	MaxWeight   float64 `json:"max_weight"`
	GoodWeight  float64 `json:"good_weight"`
	FailWeight  float64 `json:"fail_weight"`
	FailCounter int     `json:"fail_counter"`
	Grade       float64 `json:"grade"`
}

func (w *Writer) caseReport(run *model.RunResult, s model.StudentResult, id string) caseReport {
	failCounter := 0
	good := 0.0
	for _, c := range s.Checks {
		if c.Status == model.Pass {
			good += c.Weight
			continue
		}
		failCounter++
	}

	return caseReport{
		Config: w.caseConfig(s),
		// Empty on purpose: Teuton's logs carried raw ANSI and secrets.
		Logs:   []string{},
		Groups: legacyGroups(s.Checks),
		Results: caseResults{
			CaseID:     id,
			StartTime:  formatTime(s.StartedAt),
			FinishTime: formatTime(s.FinishedAt),
			Duration:   round2(s.FinishedAt.Sub(s.StartedAt).Seconds()),
			// The denominator comes from the PLAN, never from the checks that
			// happened to be recorded: that is what stops it from shrinking
			// when a machine goes missing (F-02).
			MaxWeight:   run.Plan.TotalWeight,
			GoodWeight:  good,
			FailWeight:  s.Score.Evaluable - s.Score.Obtained,
			FailCounter: failCounter,
			Grade:       legacyGrade(s.Score),
		},
	}
}

// caseConfig is the student's identity plus the address of each machine. No
// credential is ever written here, unlike Teuton, which dumped the password.
func (w *Writer) caseConfig(s model.StudentResult) map[string]any {
	cfg := map[string]any{
		"tt_testname":  w.testName,
		"tt_members":   s.Name,
		"tt_moodle_id": s.MoodleID,
		"tt_skip":      s.Status == model.StudentExcluded,
	}
	var order []string
	seen := map[string]bool{}
	for _, c := range s.Checks {
		e := c.Execution
		if e == nil || e.Host == "" || seen[e.Host] {
			continue
		}
		seen[e.Host] = true
		order = append(order, e.Host)
		n := len(order)
		ip, port := splitAddress(e.Address)
		cfg[fmt.Sprintf("host%d_ip", n)] = ip
		if port != 0 {
			cfg[fmt.Sprintf("host%d_port", n)] = port
		}
		if e.User != "" {
			cfg[fmt.Sprintf("host%d_username", n)] = e.User
		}
	}
	return cfg
}

// splitAddress turns "127.1.2.3:2201" into its two halves. An address the
// engine wrote in another shape is passed through untouched.
func splitAddress(addr string) (string, int) {
	i := strings.LastIndex(addr, ":")
	if i < 0 {
		return addr, 0
	}
	port, err := strconv.Atoi(addr[i+1:])
	if err != nil {
		return addr, 0
	}
	return addr[:i], port
}

// legacyGroups keeps the order of the PLAN and opens a new legacy group every
// time the group of the check changes, which is how the GUI shows them.
func legacyGroups(checks []model.CheckResult) []legacyGroup {
	groups := make([]legacyGroup, 0, 1)
	for i, c := range checks {
		if len(groups) == 0 || groups[len(groups)-1].Title != c.Group {
			groups = append(groups, legacyGroup{Title: c.Group})
		}
		g := &groups[len(groups)-1]
		g.Targets = append(g.Targets, target(i, c))
	}
	return groups
}

func target(i int, c model.CheckResult) legacyTarget {
	t := legacyTarget{
		TargetID:    caseID(i),
		Check:       c.Status == model.Pass,
		Weight:      c.Weight,
		Description: c.Description,
		ConnType:    "ssh",
	}
	if c.Status == model.Pass {
		t.Score = c.Weight
	}
	if e := c.Execution; e != nil {
		// The inventory transport answers without opening a session, which is
		// the closest thing Teuton had to a local check.
		if e.Transport != "ssh" {
			t.ConnType = "local"
		}
		t.Duration = round2(float64(e.DurationMS) / 1000)
		t.Command = strings.Join(e.Command, " ")
		t.Output = firstLine(e.Stdout.Text)
	}
	t.Expected, t.Alterations = expectation(c)
	switch {
	case c.Status == model.Unevaluated:
		s := sentinel(c)
		t.Output = s
		t.Result = s
	case c.Assertion != nil && c.Assertion.Matched:
		t.Result = 1
	default:
		t.Result = 0
	}
	return t
}

// expectation renders the assertion the way the legacy viewer showed it.
func expectation(c model.CheckResult) (expected, alterations string) {
	a := c.Assertion
	if a == nil {
		return "", ""
	}
	if a.Kind == "exit_code" {
		return a.Expected, "Read exit code"
	}
	return a.Expected, fmt.Sprintf("find(%s) & count", a.Expected)
}
