package model

import (
	"fmt"
	"time"
)

// Consolidating a chain of runs: the one place where a student who was left
// half-evaluated on Tuesday and finished on Wednesday gets a closed grade.
//
// It is a reading of artifacts that already exist. Nothing here writes one,
// merges two, or changes a single result: each run keeps its own artifact with
// its own evidence (ADR-0007, ADR-0018 §3). What it produces is a view, and it
// says of every result which run it came from.
//
// The grade is computed by ComputeScore, the same pure function the engine
// uses for a single run, against the same PLAN denominator. That is the point
// of doing this here and not in the interface: there is one implementation of
// what a grade is, and it lives in this package (principio 12).

// ConsolidationVersion is the version of the consolidated view this package
// writes. It is not the artifact's schema: a consolidation is not a run and
// must never be read as one.
const ConsolidationVersion = 1

// Consolidation is a chain of runs read as one. `Kind` is there so that a
// file or a pipe carrying this can never be mistaken for an artifact.
type Consolidation struct {
	Version int    `json:"consolidation_version"`
	Kind    string `json:"kind"` // always "consolidation"

	// PlanHash is the PLAN every run in the chain shared. A chain that does
	// not share it is not consolidated at all.
	PlanHash string      `json:"plan_hash"`
	Plan     PlanSummary `json:"plan"`

	// Runs is the chain, newest first.
	Runs     []ConsolidatedRun     `json:"runs"`
	Students []ConsolidatedStudent `json:"students"`
}

// ConsolidatedRun names one run of the chain, so every result can point at it.
type ConsolidatedRun struct {
	RunID      string    `json:"run_id"`
	Artifact   string    `json:"artifact"`
	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at"`
	Status     RunStatus `json:"status"`
}

// ChainLink is one run of the chain as the caller read it: the artifact and
// the file it came from. The path is carried, not deduced, because a run does
// not know what its own file is called.
type ChainLink struct {
	Artifact string
	Run      *RunResult
}

// ConsolidatedStudent is one student across the whole chain.
type ConsolidatedStudent struct {
	StudentID string              `json:"student_id"`
	Name      string              `json:"name"`
	MoodleID  string              `json:"moodle_id,omitempty"`
	Status    StudentStatus       `json:"status"`
	Score     Score               `json:"score"`
	Checks    []ConsolidatedCheck `json:"checks"`
}

// ConsolidatedCheck is one check as the chain leaves it, and where it comes
// from. It carries no execution and no assertion: that evidence lives in the
// artifact of the run named by FromRun, which is where it is read.
type ConsolidatedCheck struct {
	CheckID     string  `json:"check_id"`
	Group       string  `json:"group"`
	Description string  `json:"description"`
	Weight      float64 `json:"weight"`

	Status AcademicStatus `json:"status"`
	Cause  Cause          `json:"cause"`
	Detail string         `json:"detail,omitempty"`

	// FromRun is the run this result was taken from, and when it finished.
	FromRun   string    `json:"from_run"`
	FromRunAt time.Time `json:"from_run_at"`

	// Attempts are what happened to this same check in the runs before the
	// one it was taken from, newest first. They are a record, never a result:
	// no grade reads them. A later run where the check was not selected is not
	// an attempt and does not appear here.
	Attempts []PreviousAttempt `json:"attempts,omitempty"`
}

// Consolidate reads a chain of runs, newest first, as a single result.
//
// The rule, in one line: for each check, the result of the most recent run
// that evaluated it; if no run evaluated it, the most recent attempt, so the
// reason the teacher reads is the last one that happened.
//
// A chain whose runs do not share a PLAN is refused rather than consolidated:
// adding up checks weighed differently would hand the class a denominator that
// never existed (ADR-0004).
func Consolidate(chain []ChainLink) (*Consolidation, error) {
	if len(chain) == 0 {
		return nil, fmt.Errorf("no hay ninguna corrección que consolidar")
	}
	runs := make([]*RunResult, 0, len(chain))
	for _, link := range chain {
		runs = append(runs, link.Run)
	}
	newest := runs[0]
	for _, run := range runs[1:] {
		if run.PlanHash != newest.PlanHash {
			return nil, fmt.Errorf(
				"la corrección %s se hizo con otro examen o con otra aula que %s: "+
					"no se pueden juntar sin cambiarle el denominador a la clase",
				run.RunID, newest.RunID)
		}
	}

	out := &Consolidation{
		Version:  ConsolidationVersion,
		Kind:     "consolidation",
		PlanHash: newest.PlanHash,
		Plan:     newest.Plan,
		Runs:     make([]ConsolidatedRun, 0, len(chain)),
	}
	for _, link := range chain {
		out.Runs = append(out.Runs, ConsolidatedRun{
			RunID:      link.Run.RunID,
			Artifact:   link.Artifact,
			StartedAt:  link.Run.StartedAt,
			FinishedAt: link.Run.FinishedAt,
			Status:     link.Run.Status,
		})
	}

	for _, id := range studentOrder(runs) {
		out.Students = append(out.Students, consolidateStudent(id, runs, newest.Plan))
	}
	return out, nil
}

// studentOrder is the class in the order of the oldest run of the chain, which
// is the one that has everybody: a retry only carries the students that had
// something left. A student appearing only in a newer run is kept at the end
// instead of being dropped.
func studentOrder(runs []*RunResult) []string {
	seen := map[string]bool{}
	order := []string{}
	for i := len(runs) - 1; i >= 0; i-- {
		for _, s := range runs[i].Students {
			if !seen[s.StudentID] {
				seen[s.StudentID] = true
				order = append(order, s.StudentID)
			}
		}
	}
	return order
}

// consolidateStudent applies the rule to one student and grades the result.
func consolidateStudent(id string, runs []*RunResult, plan PlanSummary) ConsolidatedStudent {
	// Every appearance of this student, newest first.
	appearances := make([]struct {
		run     *RunResult
		student *StudentResult
	}, 0, len(runs))
	for _, run := range runs {
		for i := range run.Students {
			if run.Students[i].StudentID == id {
				appearances = append(appearances, struct {
					run     *RunResult
					student *StudentResult
				}{run, &run.Students[i]})
				break
			}
		}
	}

	out := ConsolidatedStudent{StudentID: id}
	if len(appearances) == 0 {
		return out
	}
	newest := appearances[0].student
	out.Name = newest.Name
	out.MoodleID = newest.MoodleID

	// An excluded student was never going to be evaluated, in any run of the
	// chain. There is nothing to consolidate and nothing to grade.
	if newest.Status == StudentExcluded {
		out.Status = StudentExcluded
		out.Score = newest.Score
		return out
	}

	for _, checkID := range plan.CheckIDs {
		var candidates []ConsolidatedCheck
		for _, appearance := range appearances {
			for _, c := range appearance.student.Checks {
				if c.CheckID != checkID {
					continue
				}
				candidates = append(candidates, ConsolidatedCheck{
					CheckID:     c.CheckID,
					Group:       c.Group,
					Description: c.Description,
					Weight:      c.Weight,
					Status:      c.Status,
					Cause:       c.Cause,
					Detail:      c.Detail,
					FromRun:     appearance.run.RunID,
					FromRunAt:   appearance.run.FinishedAt,
				})
			}
		}
		if len(candidates) == 0 {
			continue
		}
		out.Checks = append(out.Checks, pick(candidates))
	}

	graded := make([]CheckResult, 0, len(out.Checks))
	for _, c := range out.Checks {
		graded = append(graded, CheckResult{CheckID: c.CheckID, Weight: c.Weight, Status: c.Status})
	}
	out.Score = ComputeScore(plan, graded)
	out.Status = StudentStatusOf(graded)
	return out
}

// pick applies the rule to one check: the most recent run that evaluated it
// wins, and if none did, the most recent attempt, so the reason on screen is
// the last one that happened.
//
// What is kept beside it is only what came before, which is what the candidates
// after the chosen one are: the list runs from the newest to the oldest. A
// check that a later run did not select is left out, because not being
// repeated is not an attempt.
func pick(candidates []ConsolidatedCheck) ConsolidatedCheck {
	chosen := 0
	for i, c := range candidates {
		if c.Status != Unevaluated {
			chosen = i
			break
		}
	}
	out := candidates[chosen]
	for _, c := range candidates[chosen+1:] {
		out.Attempts = append(out.Attempts, PreviousAttempt{
			RunID:      c.FromRun,
			Status:     c.Status,
			Cause:      c.Cause,
			Detail:     c.Detail,
			FinishedAt: c.FromRunAt,
		})
	}
	return out
}
