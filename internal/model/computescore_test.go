package model

import (
	"fmt"
	"testing"
)

func check(weight float64, status AcademicStatus) CheckResult {
	c := CheckResult{Weight: weight, Status: status, Cause: CauseNone}
	if status == Unevaluated {
		c.Cause = CauseNotRun
		c.Detail = "no se llegó a ejecutar"
	}
	return c
}

func planOf(total float64) PlanSummary {
	return PlanSummary{CheckCount: 0, TotalWeight: total, Concurrency: 8}
}

// TestComputeScoreWorkedExample reproduces the example of
// docs/design/03-ESTADOS-Y-NOTA.md section 5 exactly: one check of weight 2
// passed, two of weight 4 unevaluated. The engine must refuse to call that a
// grade, and publish 100 as provisional only.
func TestComputeScoreWorkedExample(t *testing.T) {
	got := ComputeScore(planOf(10), []CheckResult{
		check(2, Pass),
		check(4, Unevaluated),
		check(4, Unevaluated),
	})

	if got.Obtained != 2 || got.Evaluable != 2 || got.Total != 10 || got.Unevaluated != 8 {
		t.Errorf("numbers = obtained %v evaluable %v total %v unevaluated %v, want 2 2 10 8",
			got.Obtained, got.Evaluable, got.Total, got.Unevaluated)
	}
	if got.Provisional == nil || *got.Provisional != 100 {
		t.Errorf("provisional_score = %v, want 100", got.Provisional)
	}
	if got.Final != nil {
		t.Errorf("final_score = %d, want null: 8 of 10 points were never looked at", *got.Final)
	}
	if got.Status != ScoreIncomplete {
		t.Errorf("status = %q, want INCOMPLETE", got.Status)
	}
}

func TestComputeScore(t *testing.T) {
	cases := []struct {
		name            string
		total           float64
		checks          []CheckResult
		wantObtained    float64
		wantEvaluable   float64
		wantUnevaluated float64
		wantProvisional *int
		wantFinal       *int
		wantStatus      ScoreStatus
	}{
		{
			name:  "everything evaluated",
			total: 5,
			checks: []CheckResult{
				check(1, Pass), check(2, Pass), check(1, Fail), check(1, Pass),
			},
			wantObtained: 4, wantEvaluable: 5, wantUnevaluated: 0,
			wantProvisional: intp(80), wantFinal: intp(80), wantStatus: ScoreComplete,
		},
		{
			name:            "nothing could be evaluated is not a zero",
			total:           5,
			checks:          []CheckResult{check(1, Unevaluated), check(4, Unevaluated)},
			wantObtained:    0,
			wantEvaluable:   0,
			wantUnevaluated: 5,
			wantProvisional: nil, wantFinal: nil, wantStatus: ScoreNotEvaluated,
		},
		{
			name:            "student with no checks at all",
			total:           5,
			checks:          nil,
			wantObtained:    0,
			wantEvaluable:   0,
			wantUnevaluated: 5,
			wantProvisional: nil, wantFinal: nil, wantStatus: ScoreNotEvaluated,
		},
		{
			name:  "everything evaluated and everything wrong is a real zero",
			total: 4,
			checks: []CheckResult{
				check(2, Fail), check(2, Fail),
			},
			wantObtained: 0, wantEvaluable: 4, wantUnevaluated: 0,
			wantProvisional: intp(0), wantFinal: intp(0), wantStatus: ScoreComplete,
		},
		{
			name:  "weight 0 unevaluated does not deny a final grade",
			total: 3,
			checks: []CheckResult{
				check(1, Pass), check(2, Pass), check(0, Unevaluated),
			},
			wantObtained: 3, wantEvaluable: 3, wantUnevaluated: 0,
			wantProvisional: intp(100), wantFinal: intp(100), wantStatus: ScoreComplete,
		},
		{
			name:  "rounding is to the nearest integer",
			total: 3,
			checks: []CheckResult{
				check(1, Pass), check(1, Fail), check(1, Fail),
			},
			wantObtained: 1, wantEvaluable: 3, wantUnevaluated: 0,
			wantProvisional: intp(33), wantFinal: intp(33), wantStatus: ScoreComplete,
		},
		{
			name:  "decimal weights do not leave a phantom remainder",
			total: 1,
			checks: []CheckResult{
				check(0.1, Pass), check(0.2, Pass), check(0.7, Fail),
			},
			wantObtained: 0.30000000000000004, wantEvaluable: 1, wantUnevaluated: 0,
			wantProvisional: intp(30), wantFinal: intp(30), wantStatus: ScoreComplete,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ComputeScore(planOf(tc.total), tc.checks)

			if got.Obtained != tc.wantObtained {
				t.Errorf("obtained = %v, want %v", got.Obtained, tc.wantObtained)
			}
			if got.Evaluable != tc.wantEvaluable {
				t.Errorf("evaluable = %v, want %v", got.Evaluable, tc.wantEvaluable)
			}
			if got.Total != tc.total {
				t.Errorf("total = %v, want %v from the plan", got.Total, tc.total)
			}
			if got.Unevaluated != tc.wantUnevaluated {
				t.Errorf("unevaluated = %v, want %v", got.Unevaluated, tc.wantUnevaluated)
			}
			if !sameInt(got.Provisional, tc.wantProvisional) {
				t.Errorf("provisional_score = %v, want %v", show(got.Provisional), show(tc.wantProvisional))
			}
			if !sameInt(got.Final, tc.wantFinal) {
				t.Errorf("final_score = %v, want %v", show(got.Final), show(tc.wantFinal))
			}
			if got.Status != tc.wantStatus {
				t.Errorf("status = %q, want %q", got.Status, tc.wantStatus)
			}
		})
	}
}

// TestComputeScoreDenominatorComesFromThePlan is invariant 1: the denominator
// is whatever the plan fixed before any machine was touched, never the sum of
// the checks that happened to come back.
func TestComputeScoreDenominatorComesFromThePlan(t *testing.T) {
	// The engine only managed to run one check of a ten point exam.
	got := ComputeScore(planOf(10), []CheckResult{check(1, Pass)})

	if got.Total != 10 {
		t.Errorf("total = %v, want 10: the exam did not shrink because the run broke", got.Total)
	}
	if got.Unevaluated != 9 {
		t.Errorf("unevaluated = %v, want 9", got.Unevaluated)
	}
	if got.Final != nil {
		t.Errorf("final_score = %d, want null", *got.Final)
	}
}

// TestComputeScoreUnevaluatedDeniesFinal is the acceptance criterion stated as
// a rule rather than as examples: any unevaluated weight at all denies a final
// grade, however small.
func TestComputeScoreUnevaluatedDeniesFinal(t *testing.T) {
	for _, missing := range []float64{0.25, 1, 5, 9.75} {
		got := ComputeScore(planOf(10), []CheckResult{
			check(10-missing, Pass),
			check(missing, Unevaluated),
		})
		if got.Final != nil {
			t.Errorf("missing %v: final_score = %d, want null", missing, *got.Final)
		}
		if got.Status != ScoreIncomplete {
			t.Errorf("missing %v: status = %q, want INCOMPLETE", missing, got.Status)
		}
	}
}

func TestStudentStatusOf(t *testing.T) {
	cases := []struct {
		name   string
		checks []CheckResult
		want   StudentStatus
	}{
		{"all evaluated", []CheckResult{check(1, Pass), check(1, Fail)}, StudentOK},
		{"some unevaluated", []CheckResult{check(1, Pass), check(1, Unevaluated)}, StudentPartial},
		{"all unevaluated", []CheckResult{check(1, Unevaluated), check(2, Unevaluated)}, StudentNotEvaluated},
		{"no checks", nil, StudentOK},
		{
			"weight 0 unevaluated does not degrade the student",
			[]CheckResult{check(1, Pass), check(0, Unevaluated)},
			StudentOK,
		},
		{
			"only weight 0 checks, all unevaluated",
			[]CheckResult{check(0, Unevaluated)},
			StudentOK,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := StudentStatusOf(tc.checks); got != tc.want {
				t.Errorf("status = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestRunStatusOf(t *testing.T) {
	student := func(s StudentStatus) StudentResult { return StudentResult{Status: s} }

	cases := []struct {
		name     string
		students []StudentResult
		want     RunStatus
	}{
		{"all ok", []StudentResult{student(StudentOK), student(StudentOK)}, RunComplete},
		{"one partial", []StudentResult{student(StudentOK), student(StudentPartial)}, RunPartial},
		{"one not evaluated", []StudentResult{student(StudentOK), student(StudentNotEvaluated)}, RunPartial},
		{
			"an excluded student does not spoil a complete run",
			[]StudentResult{student(StudentOK), student(StudentExcluded)},
			RunComplete,
		},
		{"no students", nil, RunComplete},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := RunStatusOf(tc.students); got != tc.want {
				t.Errorf("status = %q, want %q", got, tc.want)
			}
		})
	}
}

// TestScoreMatchesTheGoldenArtifact ties the pure functions back to the worked
// example of the design: recomputing the stored artifact must reproduce it.
func TestScoreMatchesTheGoldenArtifact(t *testing.T) {
	_, run := loadGolden(t)

	for _, s := range run.Students {
		got := ComputeScore(run.Plan, s.Checks)
		if !sameScore(got, s.Score) {
			t.Errorf("%s: recomputed score %s, artifact has %s", s.StudentID, showScore(got), showScore(s.Score))
		}
		if gotStatus := StudentStatusOf(s.Checks); gotStatus != s.Status {
			t.Errorf("%s: derived status %q, artifact has %q", s.StudentID, gotStatus, s.Status)
		}
	}

	if got := RunStatusOf(run.Students); got != run.Status {
		t.Errorf("derived run status %q, artifact has %q", got, run.Status)
	}
}

func intp(v int) *int { return &v }

// sameScore compares two scores by value. Score holds pointers precisely so
// that an absent grade is null rather than 0, so == would compare addresses.
func sameScore(a, b Score) bool {
	return a.Obtained == b.Obtained &&
		a.Evaluable == b.Evaluable &&
		a.Total == b.Total &&
		a.Unevaluated == b.Unevaluated &&
		a.Status == b.Status &&
		sameInt(a.Provisional, b.Provisional) &&
		sameInt(a.Final, b.Final)
}

func showScore(s Score) string {
	return fmt.Sprintf("obtained=%v evaluable=%v total=%v unevaluated=%v provisional=%v final=%v status=%s",
		s.Obtained, s.Evaluable, s.Total, s.Unevaluated, show(s.Provisional), show(s.Final), s.Status)
}

func sameInt(a, b *int) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func show(p *int) any {
	if p == nil {
		return "null"
	}
	return *p
}

func TestPositivePendingWeightNeverDisappears(t *testing.T) {
	for _, weight := range []float64{1e-10, 1e-100, 1e-300} {
		checks := []CheckResult{check(1, Pass), check(weight, Unevaluated)}
		got := ComputeScore(planOf(1+weight), checks)
		if got.Status != ScoreIncomplete || got.Final != nil || got.Unevaluated != weight || StudentStatusOf(checks) != StudentPartial {
			t.Fatalf("%v: %+v", weight, got)
		}
	}
	for _, weight := range []float64{1e-300, 1e308} {
		got := ComputeScore(planOf(weight), []CheckResult{check(weight, Pass)})
		if got.Final == nil || *got.Final != 100 {
			t.Fatalf("%v: %+v", weight, got)
		}
	}
}
