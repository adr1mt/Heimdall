package model

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

// The real classroom case of an exam session: during the practical the student
// installs, breaks and fixes things, and the engine corrects the class over and
// over. What counts is the best round that came out whole, not whatever was
// standing when the bell rang.

func minute(m int) time.Time {
	return time.Date(2026, 9, 20, 10, m, 0, 0, time.UTC)
}

func sessPlan() PlanSummary {
	ids := []string{"C-01", "C-02", "C-03", "C-04", "C-05", "C-06", "C-07", "C-08", "C-09", "C-10"}
	return PlanSummary{CheckCount: 10, TotalWeight: 10, CheckIDs: ids}
}

// sessStudent builds a student of the ten-check plan: `pass` checks passing,
// `unevaluated` checks that could not be looked at, the rest failing.
func sessStudent(id string, m, pass, unevaluated int) StudentResult {
	plan := sessPlan()
	checks := make([]CheckResult, 0, len(plan.CheckIDs))
	for i, checkID := range plan.CheckIDs {
		c := CheckResult{CheckID: checkID, Group: "red", Description: checkID, Weight: 1}
		switch {
		case i >= len(plan.CheckIDs)-unevaluated:
			c.Status, c.Cause = Unevaluated, CauseConnectFailed
		case i < pass:
			c.Status, c.Cause = Pass, CauseNone
		default:
			c.Status, c.Cause = Fail, CauseNone
		}
		checks = append(checks, c)
	}
	return StudentResult{
		StudentID:  id,
		Name:       id,
		Status:     StudentStatusOf(checks),
		StartedAt:  minute(m),
		FinishedAt: minute(m),
		Score:      ComputeScore(plan, checks),
		Checks:     checks,
	}
}

func sessRound(id string, m int, students ...StudentResult) SessionRound {
	return SessionRound{
		Artifact: "var/" + id + ".json",
		Run: &RunResult{
			SchemaVersion: SchemaVersion,
			RunID:         id,
			StartedAt:     minute(m),
			FinishedAt:    minute(m),
			Status:        RunStatusOf(students),
			PlanHash:      "hash-del-examen",
			Plan:          sessPlan(),
			Students:      students,
		},
	}
}

func buildOK(t *testing.T, rounds ...SessionRound) *Session {
	t.Helper()
	s, err := BuildSession(rounds)
	if err != nil {
		t.Fatalf("BuildSession: %v", err)
	}
	return s
}

func onlyStudent(t *testing.T, s *Session) SessionStudent {
	t.Helper()
	if len(s.Students) != 1 {
		t.Fatalf("got %d students, want 1", len(s.Students))
	}
	return s.Students[0]
}

// The rule itself: four photographs of the same exam and the best whole one
// wins, whatever came after it (ADR-0020 §1).
func TestSessionKeepsTheBestCompleteRound(t *testing.T) {
	s := buildOK(t,
		sessRound("R1", 0, sessStudent("alumne01", 0, 6, 0)),
		sessRound("R2", 10, sessStudent("alumne01", 10, 8, 0)),
		sessRound("R3", 20, sessStudent("alumne01", 20, 7, 0)),
		sessRound("R4", 30, sessStudent("alumne01", 30, 9, 0)),
	)
	got := onlyStudent(t, s)

	if got.Score.Final == nil || *got.Score.Final != 90 {
		t.Errorf("final score = %v, want 90", got.Score.Final)
	}
	if got.FromRound != 4 || got.FromRunID != "R4" {
		t.Errorf("grade comes from round %d (%s), want round 4 (R4)", got.FromRound, got.FromRunID)
	}
	if got.Status != SessionActive {
		t.Errorf("status = %s, want %s", got.Status, SessionActive)
	}
}

// The best round is not the last one: a student who broke something at the end
// keeps what they had (ADR-0020 §1).
func TestSessionBestRoundIsNotTheLastOne(t *testing.T) {
	s := buildOK(t,
		sessRound("R1", 0, sessStudent("alumne01", 0, 6, 0)),
		sessRound("R2", 10, sessStudent("alumne01", 10, 9, 0)),
		sessRound("R3", 20, sessStudent("alumne01", 20, 4, 0)),
	)
	got := onlyStudent(t, s)

	if got.Score.Final == nil || *got.Score.Final != 90 || got.FromRound != 2 {
		t.Errorf("got %v from round %d, want 90 from round 2", got.Score.Final, got.FromRound)
	}
}

// A round that did not come out whole does not compete, so it cannot lower a
// grade that was already there. A technical fault never lowers a grade
// (ADR-0020 §2, principio 3).
func TestSessionLaterIncompleteRoundDoesNotReplaceACompleteOne(t *testing.T) {
	cases := []struct {
		name  string
		later StudentResult
	}{
		{"provisional", sessStudent("alumne01", 40, 10, 7)},  // only three checks looked at
		{"unevaluated", sessStudent("alumne01", 40, 0, 10)},  // machine off
		{"partial mejor", sessStudent("alumne01", 40, 9, 1)}, // would be a 100 provisional
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := buildOK(t,
				sessRound("R1", 0, sessStudent("alumne01", 0, 9, 0)),
				sessRound("R2", 40, tc.later),
			)
			got := onlyStudent(t, s)

			if got.Score.Final == nil || *got.Score.Final != 90 {
				t.Errorf("final score = %v, want the 90 of round 1", got.Score.Final)
			}
			if got.FromRound != 1 {
				t.Errorf("grade comes from round %d, want 1", got.FromRound)
			}
			if got.Score.Status != ScoreComplete {
				t.Errorf("score status = %s, want %s", got.Score.Status, ScoreComplete)
			}
		})
	}
}

// Without a single whole round there is no session grade, and the view says
// why. Not a zero (ADR-0020 §3, ADR-0006).
func TestSessionWithoutACompleteRoundHasNoGrade(t *testing.T) {
	s := buildOK(t,
		sessRound("R1", 0, sessStudent("alumne01", 0, 3, 7)),
		sessRound("R2", 10, sessStudent("alumne01", 10, 0, 10)),
	)
	got := onlyStudent(t, s)

	if got.Status != SessionActive {
		t.Errorf("status = %s, want %s", got.Status, SessionActive)
	}
	if got.Score.Final != nil {
		t.Errorf("final score = %d, want none at all", *got.Score.Final)
	}
	if got.FromRound != 0 || got.FromRunID != "" {
		t.Errorf("grade points at round %d (%s), and there is no grade", got.FromRound, got.FromRunID)
	}
	if got.Reason == "" {
		t.Error("no session grade and no reason given; the teacher is left without an explanation")
	}
	if len(got.Rounds) != 2 {
		t.Errorf("kept %d rounds of history, want 2", len(got.Rounds))
	}
	for _, a := range got.Rounds {
		if a.Counts {
			t.Errorf("round %d counts, and no round gave a grade", a.Round)
		}
	}
}

// FINISHED is the whole weight of the PLAN, derived and never marked
// (ADR-0020 §4).
func TestSessionFinishedIsDerivedFromTheWholePlan(t *testing.T) {
	s := buildOK(t,
		sessRound("R1", 0, sessStudent("alumne01", 0, 9, 0)),
		sessRound("R2", 10, sessStudent("alumne01", 10, 10, 0)),
	)
	got := onlyStudent(t, s)

	if got.Status != SessionFinished {
		t.Errorf("status = %s, want %s", got.Status, SessionFinished)
	}
	if got.FromRound != 2 {
		t.Errorf("finished on round %d, want 2", got.FromRound)
	}
}

// The border of FINISHED, on the exam Adrià described: sixteen checks.
// Having every check evaluated is not being finished if any of them is FAIL —
// the student can still fix it, so the session keeps correcting them
// (ADR-0020 §4).
func TestSessionFinishedOnlyAtTheFullWeight(t *testing.T) {
	plan := PlanSummary{CheckCount: 16, TotalWeight: 16}
	for i := 1; i <= 16; i++ {
		plan.CheckIDs = append(plan.CheckIDs, fmt.Sprintf("C-%02d", i))
	}
	student := func(pass, unevaluated int) StudentResult {
		checks := make([]CheckResult, 0, 16)
		for i, id := range plan.CheckIDs {
			c := CheckResult{CheckID: id, Weight: 1}
			switch {
			case i >= 16-unevaluated:
				c.Status, c.Cause = Unevaluated, CauseConnectFailed
			case i < pass:
				c.Status = Pass
			default:
				c.Status = Fail
			}
			checks = append(checks, c)
		}
		return StudentResult{
			StudentID: "alumne01", Name: "alumne01",
			Status: StudentStatusOf(checks), Score: ComputeScore(plan, checks), Checks: checks,
		}
	}
	round := func(id string, m int, s StudentResult) SessionRound {
		return SessionRound{Artifact: "var/" + id + ".json", Run: &RunResult{
			SchemaVersion: SchemaVersion, RunID: id, StartedAt: minute(m), FinishedAt: minute(m),
			Status: RunStatusOf([]StudentResult{s}), PlanHash: "hash-del-examen",
			Plan: plan, Students: []StudentResult{s},
		}}
	}

	cases := []struct {
		name      string
		student   StudentResult
		want      SessionStatus
		wantScore *int // nil means no session grade at all
	}{
		{"16 de 16 evaluadas, todas PASS", student(16, 0), SessionFinished, intp(100)},
		{"16 de 16 evaluadas, alguna FAIL", student(13, 0), SessionActive, intp(81)},
		{"15 de 16 evaluadas, provisional", student(14, 1), SessionActive, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := onlyStudent(t, buildOK(t, round("R1", 0, tc.student)))
			if got.Status != tc.want {
				t.Errorf("status = %s, want %s", got.Status, tc.want)
			}
			switch {
			case tc.wantScore == nil && got.Score.Final != nil:
				t.Errorf("final score = %d, want no session grade", *got.Score.Final)
			case tc.wantScore != nil && (got.Score.Final == nil || *got.Score.Final != *tc.wantScore):
				t.Errorf("final score = %v, want %d", got.Score.Final, *tc.wantScore)
			}
		})
	}
}

// A 99.6 % rounds to 100 and is still not finished: FINISHED is compared on
// the raw weights, never on the published integer (ADR-0020 §4).
func TestSessionRoundedHundredIsNotFinished(t *testing.T) {
	plan := PlanSummary{CheckCount: 2, TotalWeight: 250, CheckIDs: []string{"C-1", "C-2"}}
	checks := []CheckResult{
		{CheckID: "C-1", Weight: 249, Status: Pass},
		{CheckID: "C-2", Weight: 1, Status: Fail},
	}
	student := StudentResult{
		StudentID: "alumne01", Name: "alumne01",
		Status: StudentStatusOf(checks), Score: ComputeScore(plan, checks), Checks: checks,
	}
	run := &RunResult{
		SchemaVersion: SchemaVersion, RunID: "R1", FinishedAt: minute(0),
		Status: RunStatusOf([]StudentResult{student}), PlanHash: "hash-del-examen",
		Plan: plan, Students: []StudentResult{student},
	}
	s := buildOK(t, SessionRound{Artifact: "var/R1.json", Run: run})
	got := onlyStudent(t, s)

	if got.Score.Final == nil || *got.Score.Final != 100 {
		t.Fatalf("final score = %v, want the rounded 100", got.Score.Final)
	}
	if got.Status != SessionActive {
		t.Errorf("status = %s, want %s: a rounded 100 is not the whole PLAN", got.Status, SessionActive)
	}
}

// A tie goes to the first round that reached the grade: that is when the
// student got there (ADR-0020 §1).
func TestSessionTieKeepsTheFirstRoundThatReachedIt(t *testing.T) {
	s := buildOK(t,
		sessRound("R1", 0, sessStudent("alumne01", 0, 5, 0)),
		sessRound("R2", 10, sessStudent("alumne01", 10, 8, 0)),
		sessRound("R3", 20, sessStudent("alumne01", 20, 8, 0)),
	)
	if got := onlyStudent(t, s); got.FromRound != 2 {
		t.Errorf("grade comes from round %d, want 2", got.FromRound)
	}
}

// The whole history is kept, and exactly one round is marked as the one that
// counts (ADR-0020 §6).
func TestSessionKeepsEveryRoundOfTheHistory(t *testing.T) {
	s := buildOK(t,
		sessRound("R1", 0, sessStudent("alumne01", 0, 6, 0)),
		sessRound("R2", 10, sessStudent("alumne01", 10, 8, 0)),
		sessRound("R3", 20, sessStudent("alumne01", 20, 7, 0)),
		sessRound("R4", 30, sessStudent("alumne01", 30, 9, 0)),
	)
	got := onlyStudent(t, s)

	if len(got.Rounds) != 4 {
		t.Fatalf("kept %d rounds, want 4", len(got.Rounds))
	}
	want := []int{60, 80, 70, 90}
	var counted int
	for i, a := range got.Rounds {
		if a.Round != i+1 {
			t.Errorf("round %d of the history is numbered %d", i+1, a.Round)
		}
		if a.Score.Final == nil || *a.Score.Final != want[i] {
			t.Errorf("round %d says %v, want %d", i+1, a.Score.Final, want[i])
		}
		if a.Counts {
			counted++
		}
	}
	if counted != 1 {
		t.Errorf("%d rounds marked as the one that counts, want exactly 1", counted)
	}
	if !got.Rounds[3].Counts {
		t.Error("the round that counts is not the one with the best complete grade")
	}
	if len(s.Rounds) != 4 || s.Rounds[0].Artifact != "var/R1.json" {
		t.Errorf("the session does not name its four rounds: %+v", s.Rounds)
	}
}

// Each student is read on their own: the best round of one is not the best
// round of another.
func TestSessionGradesEachStudentOnTheirOwnBestRound(t *testing.T) {
	s := buildOK(t,
		sessRound("R1", 0,
			sessStudent("alumne01", 0, 9, 0),
			sessStudent("alumne02", 0, 4, 0)),
		sessRound("R2", 10,
			sessStudent("alumne01", 10, 5, 0),
			sessStudent("alumne02", 10, 8, 0)),
	)
	if len(s.Students) != 2 {
		t.Fatalf("got %d students, want 2", len(s.Students))
	}
	want := map[string]struct {
		score int
		round int
	}{
		"alumne01": {90, 1},
		"alumne02": {80, 2},
	}
	for _, got := range s.Students {
		w := want[got.StudentID]
		if got.Score.Final == nil || *got.Score.Final != w.score || got.FromRound != w.round {
			t.Errorf("%s: %v from round %d, want %d from round %d",
				got.StudentID, got.Score.Final, got.FromRound, w.score, w.round)
		}
	}
}

// An excluded student has no grade and the view says so, without inventing a
// zero.
func TestSessionExcludedStudentHasNoGrade(t *testing.T) {
	excluded := sessStudent("alumne02", 0, 0, 0)
	excluded.Status = StudentExcluded
	excluded.Checks = nil
	excluded.Score = Score{Status: ScoreExcluded}

	s := buildOK(t, sessRound("R1", 0, excluded))
	got := onlyStudent(t, s)

	if got.Status != SessionExcluded {
		t.Errorf("status = %s, want %s", got.Status, SessionExcluded)
	}
	if got.Score.Final != nil {
		t.Errorf("final score = %d, and an excluded student has none", *got.Score.Final)
	}
	if got.Reason == "" {
		t.Error("an excluded student with no reason on screen")
	}
}

// Rounds of different exams are not a session: comparing grades against
// different denominators compares nothing (ADR-0020 §5).
func TestSessionRefusesRoundsOfAnotherExam(t *testing.T) {
	other := sessRound("R2", 10, sessStudent("alumne01", 10, 9, 0))
	other.Run.PlanHash = "hash-de-otro-examen"

	_, err := BuildSession([]SessionRound{
		sessRound("R1", 0, sessStudent("alumne01", 0, 6, 0)),
		other,
	})
	if err == nil {
		t.Fatal("two different exams read as one session")
	}
	if !strings.Contains(err.Error(), "R2") {
		t.Errorf("the error does not say which round does not fit: %v", err)
	}
}

// Rounds out of order are refused: if the order is not the real one, "which
// round the grade comes from" is a lie (ADR-0020 §5).
func TestSessionRefusesRoundsOutOfOrder(t *testing.T) {
	_, err := BuildSession([]SessionRound{
		sessRound("R2", 30, sessStudent("alumne01", 30, 9, 0)),
		sessRound("R1", 0, sessStudent("alumne01", 0, 6, 0)),
	})
	if err == nil {
		t.Fatal("rounds read out of the order they ran")
	}
	if !strings.Contains(err.Error(), "R1") {
		t.Errorf("the error does not say which round is out of place: %v", err)
	}
}

func TestSessionRefusesNoRounds(t *testing.T) {
	if _, err := BuildSession(nil); err == nil {
		t.Fatal("an empty session was accepted")
	}
}

// The view is a view: it says what it is, so nothing can read it as a run that
// never happened (ADR-0020 §7, ADR-0007).
func TestSessionSaysItIsNotAnArtifact(t *testing.T) {
	s := buildOK(t, sessRound("R1", 0, sessStudent("alumne01", 0, 9, 0)))
	if s.Kind != "session" {
		t.Errorf("kind = %q, want %q", s.Kind, "session")
	}
	if s.Version != SessionVersion {
		t.Errorf("version = %d, want %d", s.Version, SessionVersion)
	}
	if s.PlanHash != "hash-del-examen" {
		t.Errorf("plan hash = %q", s.PlanHash)
	}
	if s.Plan.TotalWeight != 10 {
		t.Errorf("the session does not carry the PLAN denominator: %v", s.Plan)
	}
}

// sessExcluded is the student the inventory leaves out: nothing ran and there
// is no grade.
func sessExcluded(id string, m int) StudentResult {
	return StudentResult{
		StudentID:  id,
		Name:       id,
		Status:     StudentExcluded,
		StartedAt:  minute(m),
		FinishedAt: minute(m),
		Score:      Score{Total: sessPlan().TotalWeight, Status: ScoreExcluded},
	}
}

// The classroom leaving a student out is not a grade and never becomes one.
func TestSessionExcludedByTheInventoryHasNoGrade(t *testing.T) {
	s := buildOK(t,
		sessRound("R1", 0, sessExcluded("alumne09", 0)),
		sessRound("R2", 10, sessExcluded("alumne09", 10)),
	)
	got := onlyStudent(t, s)

	if got.Status != SessionExcluded {
		t.Errorf("estado = %s, se esperaba %s", got.Status, SessionExcluded)
	}
	if got.Score.Final != nil || got.FromRound != 0 {
		t.Errorf("nota = %v de la vuelta %d: al alumno que el aula deja fuera no se le pone nota", got.Score.Final, got.FromRound)
	}
	if got.Reason == "" {
		t.Error("tiene que decir por qué no tiene nota")
	}
}

// The one that T063 depends on: a student the session already finished is left
// out of the next round, and that round does not take their grade away
// (ADR-0020 §2 y §4).
func TestSessionKeepsTheGradeOfAStudentLeftOutAfterFinishing(t *testing.T) {
	s := buildOK(t,
		sessRound("R1", 0, sessStudent("alumne01", 0, 8, 0)),
		sessRound("R2", 10, sessStudent("alumne01", 10, 10, 0)),
		sessRound("R3", 20, sessExcluded("alumne01", 20)),
	)
	got := onlyStudent(t, s)

	if got.Status != SessionFinished {
		t.Errorf("estado = %s, se esperaba %s: ya tenía el examen entero", got.Status, SessionFinished)
	}
	if got.Score.Final == nil || *got.Score.Final != 100 || got.FromRound != 2 {
		t.Errorf("nota = %v de la vuelta %d, se esperaba 100 de la vuelta 2", got.Score.Final, got.FromRound)
	}
	if len(got.Rounds) != 3 || got.Rounds[2].Status != StudentExcluded {
		t.Errorf("el histórico tiene que guardar también la vuelta que lo dejó fuera: %+v", got.Rounds)
	}
}
