package model

import (
	"fmt"
	"time"
)

// An exam session: the rounds of one exam read as one thing.
//
// This is the opposite rule to Consolidate, on purpose, and the difference is
// the whole point of ADR-0020. A retry chain repeats only what was left
// unevaluated, so the newest result replaces the older one. A session repeats
// the whole class over and over while the students are still working, so each
// round is a photograph of the same exam and the one that counts is the best
// round that came out complete.
//
// Nothing here writes, merges or touches an artifact (ADR-0007): every round
// keeps its own, with its own evidence. What comes out is a view that says,
// for every student, which round the grade comes from and what each round said.

// SessionVersion is the version of the session view this package writes. It is
// not the artifact's schema and not the consolidation's: a session is neither.
const SessionVersion = 1

// SessionStatus is where a student stands in the session. It answers one
// question and only one: does the next round still have to correct them? It is
// derived from the rounds, never given as input (ADR-0020 §4).
//
// Whether there is a session grade yet is a different question, and it is
// answered by the score and by FromRound, not by this.
type SessionStatus string

const (
	// SessionActive means the session is still correcting this student. Every
	// round of the session touches them.
	//
	// A student with a complete grade below the full weight is still ACTIVE:
	// having every check evaluated is not being finished if any of them is
	// FAIL. They can still fix it and be corrected again.
	SessionActive SessionStatus = "ACTIVE"
	// SessionFinished means one round gave the student the whole weight of the
	// PLAN: every check evaluated and every check PASS. There is nothing left
	// to correct, so the next round leaves them out (T063).
	SessionFinished SessionStatus = "FINISHED"
	// SessionExcluded mirrors StudentExcluded: the inventory left the student
	// out, so no round was ever going to evaluate them.
	SessionExcluded SessionStatus = "EXCLUDED"
)

// SessionRound is one round as the caller read it: the artifact and the file
// it came from. Rounds are given oldest first, in the order they ran.
type SessionRound struct {
	Artifact string
	Run      *RunResult
}

// Session is the rounds of one exam read as one result.
type Session struct {
	Version int    `json:"session_version"`
	Kind    string `json:"kind"` // always "session"

	// PlanHash is the PLAN every round shared. Rounds that do not share it do
	// not form a session at all.
	PlanHash string      `json:"plan_hash"`
	Plan     PlanSummary `json:"plan"`

	// Rounds is the session, oldest first, numbered from 1.
	Rounds   []SessionRoundRef `json:"rounds"`
	Students []SessionStudent  `json:"students"`
}

// SessionRoundRef names one round, so every grade can point at it.
type SessionRoundRef struct {
	Round      int       `json:"round"` // 1-based, in the order they ran
	RunID      string    `json:"run_id"`
	Artifact   string    `json:"artifact"`
	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at"`
	Status     RunStatus `json:"status"`
}

// SessionStudent is one student across the whole session.
type SessionStudent struct {
	StudentID string        `json:"student_id"`
	Name      string        `json:"name"`
	MoodleID  string        `json:"moodle_id,omitempty"`
	Status    SessionStatus `json:"status"`

	// Score is the grade of the best complete round, and FromRound says which
	// one it was. A round is complete when every check of weight > 0 was
	// evaluated and there is a final_score; a provisional one is not a grade
	// and does not compete (ADR-0006, ADR-0020 §2).
	//
	// With no complete round there is no session grade: Score is the last
	// round's, which is never COMPLETE, FromRound is 0 and Reason says why.
	Score     Score  `json:"score"`
	FromRound int    `json:"from_round"` // 0 when there is no session grade
	FromRunID string `json:"from_run_id,omitempty"`
	Reason    string `json:"reason,omitempty"`

	// Rounds is what every round said about this student, oldest first. It is
	// a record, never a result: no grade reads it (ADR-0020 §6).
	Rounds []SessionAttempt `json:"rounds"`
}

// SessionAttempt is one student in one round. It carries no checks and no
// output: that evidence lives in that round's own artifact.
type SessionAttempt struct {
	Round      int           `json:"round"`
	RunID      string        `json:"run_id"`
	FinishedAt time.Time     `json:"finished_at"`
	Status     StudentStatus `json:"status"`
	Score      Score         `json:"score"`
	// Counts is true for the one round the session grade came from.
	Counts bool `json:"counts"`
}

// BuildSession reads the rounds of one exam session, oldest first, as a single
// result.
//
// The rule, in one line: for each student, the highest final grade among the
// rounds where their evaluation came out complete. A later round can never
// lower it, because a round that is not complete does not compete at all.
//
// It is pure: no network, no disk, no clock.
func BuildSession(rounds []SessionRound) (*Session, error) {
	if len(rounds) == 0 {
		return nil, fmt.Errorf("no hay ninguna vuelta que leer como sesión de examen")
	}
	first := rounds[0].Run
	for _, r := range rounds[1:] {
		if r.Run.PlanHash != first.PlanHash {
			return nil, fmt.Errorf(
				"la vuelta %s se hizo con otro examen o con otra aula que %s: "+
					"no son vueltas del mismo examen y sus notas no se pueden comparar",
				r.Run.RunID, first.RunID)
		}
	}
	// The order is the order they ran, and it is the caller's to get right:
	// if it is wrong, "which round the grade comes from" is a lie (ADR-0020 §5).
	for i := 1; i < len(rounds); i++ {
		if rounds[i].Run.FinishedAt.Before(rounds[i-1].Run.FinishedAt) {
			return nil, fmt.Errorf(
				"la vuelta %s terminó antes que la anterior (%s): las vueltas "+
					"de una sesión se leen en el orden en que se corrieron",
				rounds[i].Run.RunID, rounds[i-1].Run.RunID)
		}
	}

	out := &Session{
		Version:  SessionVersion,
		Kind:     "session",
		PlanHash: first.PlanHash,
		Plan:     first.Plan,
		Rounds:   make([]SessionRoundRef, 0, len(rounds)),
	}
	for i, r := range rounds {
		out.Rounds = append(out.Rounds, SessionRoundRef{
			Round:      i + 1,
			RunID:      r.Run.RunID,
			Artifact:   r.Artifact,
			StartedAt:  r.Run.StartedAt,
			FinishedAt: r.Run.FinishedAt,
			Status:     r.Run.Status,
		})
	}

	for _, id := range sessionStudentOrder(rounds) {
		out.Students = append(out.Students, sessionStudent(id, rounds))
	}
	return out, nil
}

// sessionStudentOrder is the class in the order of the first round, which is
// the one that has everybody. A student appearing only later —added to the
// inventory mid-session— is kept at the end instead of being dropped.
func sessionStudentOrder(rounds []SessionRound) []string {
	seen := map[string]bool{}
	order := []string{}
	for _, r := range rounds {
		for _, s := range r.Run.Students {
			if !seen[s.StudentID] {
				seen[s.StudentID] = true
				order = append(order, s.StudentID)
			}
		}
	}
	return order
}

// sessionStudent applies the rule to one student.
//
// The best round is looked for before anything else, on purpose: a round that
// left the student out does not erase what an earlier one had already given
// them. That is how a student the session already finished —and whom the next
// round leaves out (T063)— keeps their grade instead of losing it the moment
// they stop being corrected.
func sessionStudent(id string, rounds []SessionRound) SessionStudent {
	out := SessionStudent{StudentID: id}

	var last *StudentResult
	for i, r := range rounds {
		s := studentIn(r.Run, id)
		if s == nil {
			continue
		}
		last = s
		out.Name = s.Name
		out.MoodleID = s.MoodleID
		out.Rounds = append(out.Rounds, SessionAttempt{
			Round:      i + 1,
			RunID:      r.Run.RunID,
			FinishedAt: r.Run.FinishedAt,
			Status:     s.Status,
			Score:      s.Score,
		})
	}
	if last == nil {
		// Cannot happen: the order comes from the rounds themselves.
		out.Status = SessionActive
		out.Reason = "el alumno no aparece en ninguna vuelta de la sesión"
		return out
	}

	// Only complete rounds compete (ADR-0020 §2). Ties go to the first round
	// that reached the grade: that is when the student got there.
	best := -1
	bestPerfect := false
	for i, a := range out.Rounds {
		if a.Score.Status != ScoreComplete || a.Score.Final == nil {
			continue
		}
		perfect := perfectPositiveChecks(studentIn(rounds[a.Round-1].Run, id))
		if best < 0 || (perfect && !bestPerfect) || (perfect == bestPerfect && a.Score.Obtained > out.Rounds[best].Score.Obtained) {
			best = i
			bestPerfect = perfect
		}
	}

	if best < 0 {
		if last.Status == StudentExcluded {
			// Nobody was ever going to evaluate them, so there is nothing to
			// compare and nothing to grade.
			out.Status = SessionExcluded
			out.Score = last.Score
			out.Reason = "el aula deja fuera a este alumno: ninguna vuelta lo iba a evaluar"
			return out
		}
		// Still working and nothing whole to grade yet. Not a zero, and not a
		// reason to stop correcting them (ADR-0020 §3).
		out.Status = SessionActive
		out.Score = last.Score
		out.Reason = "ninguna vuelta de la sesión llegó a evaluarlo entero, " +
			"así que todavía no tiene nota de la sesión"
		return out
	}

	out.Rounds[best].Counts = true
	out.Score = out.Rounds[best].Score
	out.FromRound = out.Rounds[best].Round
	out.FromRunID = out.Rounds[best].RunID

	// FINISHED is the full weight of the PLAN, not merely a complete grade:
	// every check evaluated and every check PASS. Compared on the raw weights,
	// because the published 0-100 integer rounds (ADR-0020 §4).
	if bestPerfect {
		out.Status = SessionFinished
	} else {
		out.Status = SessionActive
	}
	return out
}

// studentIn finds one student in one run, or nil when that round did not carry
// them.
func studentIn(run *RunResult, id string) *StudentResult {
	for i := range run.Students {
		if run.Students[i].StudentID == id {
			return &run.Students[i]
		}
	}
	return nil
}

// A tiny failed weight can disappear in a float64 sum. The checks themselves
// still prove whether this round is perfect; that proof wins rounded ties.
func perfectPositiveChecks(s *StudentResult) bool {
	if s == nil || s.Status == StudentExcluded {
		return false
	}
	positive := false
	for _, c := range s.Checks {
		if c.Weight > 0 {
			positive = true
			if c.Status != Pass {
				return false
			}
		}
	}
	return positive
}
