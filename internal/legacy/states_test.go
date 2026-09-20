package legacy

import (
	"path/filepath"
	"testing"
	"time"

	"heimdall/internal/model"
)

// unevaluated is a check that never produced a trustworthy execution.
func unevaluated(id, host string, cause model.Cause) model.CheckResult {
	c := model.CheckResult{
		CheckID: id, Group: "Red", Description: id, Weight: 1,
		Status: model.Unevaluated, Cause: cause,
	}
	if host != "" {
		c.Execution = &model.ExecutionResult{
			Host: host, Address: "127.1.2.3:2201", User: "alumno", Transport: "ssh",
			Command: []string{"whoami"},
		}
	}
	return c
}

func runWith(students ...model.StudentResult) *model.RunResult {
	at := time.Date(2026, 9, 16, 20, 45, 36, 0, time.UTC)
	return &model.RunResult{
		StartedAt: at, FinishedAt: at, Status: model.RunPartial,
		Plan:     model.PlanSummary{CheckCount: 2, TotalWeight: 2},
		Students: students,
	}
}

func caseOf(t *testing.T, dir string, n string) map[string]any {
	t.Helper()
	return readJSON(t, filepath.Join(dir, "case-"+n+".json"))
}

// TestIncompleteIsZeroWithConnStatus is the rule that keeps the GUI from
// publishing an incomplete grade as if it were final.
func TestIncompleteIsZeroWithConnStatus(t *testing.T) {
	partial := model.StudentResult{
		StudentID: "alu1", Name: "Alumno 1", MoodleID: "201", Status: model.StudentPartial,
		Score: model.Score{
			Obtained: 1, Evaluable: 1, Total: 2, Unevaluated: 1,
			Provisional: ptr(100), Final: nil, Status: model.ScoreIncomplete,
		},
		Checks: []model.CheckResult{
			{CheckID: "ok", Group: "Red", Description: "ok", Weight: 1, Status: model.Pass,
				Cause: model.CauseNone,
				Execution: &model.ExecutionResult{Host: "srv", Address: "127.1.2.3:2201",
					Transport: "ssh", Command: []string{"echo", "hola"}, Completed: true,
					ExitCode: ptr(0), Stdout: model.Stream{Text: "hola\n"}},
				Assertion: &model.AssertionResult{Kind: "contains", Expected: "hola", Matched: true}},
			unevaluated("caido", "srv", model.CauseTimeout),
		},
	}
	dir := write(t, runWith(partial))
	line := readJSON(t, filepath.Join(dir, "resume.json"))["cases"].([]any)[0].(map[string]any)

	if line["grade"] != 0.0 {
		t.Errorf("grade: %v, se esperaba 0 para un INCOMPLETE", line["grade"])
	}
	conn := line["conn_status"].(map[string]any)
	if len(conn) == 0 {
		t.Fatal("un INCOMPLETE sin conn_status: la GUI lo publicaría como nota final")
	}
	if conn["srv"] != labelError {
		t.Errorf("conn_status[srv]: %v", conn["srv"])
	}
	if line["letter"] != "✗" {
		t.Errorf("letter: %v", line["letter"])
	}
}

// TestUnevaluatedTargetIsNotAPass protects the one thing that must never leak
// through the conversion: a check nobody could look at is not a pass.
func TestUnevaluatedTargetIsNotAPass(t *testing.T) {
	lost := model.StudentResult{
		StudentID: "alu2", Name: "Alumno 2", Status: model.StudentNotEvaluated,
		Score: model.Score{Total: 2, Unevaluated: 2, Status: model.ScoreNotEvaluated},
		Checks: []model.CheckResult{
			unevaluated("auth", "srv", model.CauseAuthFailed),
			unevaluated("resto", "srv", model.CauseNotRun),
		},
	}
	dir := write(t, runWith(lost))
	targets := targetsOf(t, caseOf(t, dir, "01"))

	for i, target := range targets {
		if target["check"] != false || target["score"] != 0.0 {
			t.Errorf("target %d: check=%v score=%v", i+1, target["check"], target["score"])
		}
	}
	if targets[0]["output"] != sentinelAuth {
		t.Errorf("output de un fallo de credenciales: %v", targets[0]["output"])
	}
	if targets[1]["output"] != sentinelNoConn {
		t.Errorf("output de una comprobación que no llegó a lanzarse: %v", targets[1]["output"])
	}

	line := readJSON(t, filepath.Join(dir, "resume.json"))["cases"].([]any)[0].(map[string]any)
	// AUTH_FAILED wins over NOT_RUN: it is what the teacher has to fix.
	if conn := line["conn_status"].(map[string]any); conn["srv"] != labelAuthFailed {
		t.Errorf("conn_status[srv]: %v, se esperaba %s", conn["srv"], labelAuthFailed)
	}
	// The denominator is the PLAN's, not the checks that were recorded (F-02).
	if res := caseOf(t, dir, "01")["results"].(map[string]any); res["max_weight"] != 2.0 {
		t.Errorf("max_weight: %v, se esperaba el del PLAN", res["max_weight"])
	}
}

// TestUnknownHostStillLeavesALabel covers the check that failed before it
// knew which machine it was talking to.
func TestUnknownHostStillLeavesALabel(t *testing.T) {
	broken := model.StudentResult{
		StudentID: "alu3", Name: "Alumno 3", Status: model.StudentNotEvaluated,
		Score:  model.Score{Total: 1, Unevaluated: 1, Status: model.ScoreNotEvaluated},
		Checks: []model.CheckResult{unevaluated("fallo", "", model.CauseEngineError)},
	}
	dir := write(t, runWith(broken))
	line := readJSON(t, filepath.Join(dir, "resume.json"))["cases"].([]any)[0].(map[string]any)
	if conn := line["conn_status"].(map[string]any); conn[unknownHost] != labelError {
		t.Errorf("conn_status: %v", conn)
	}
}

// TestExcludedStudent is the student the inventory left out: skip, no grade
// and no machine to blame.
func TestExcludedStudent(t *testing.T) {
	out := model.StudentResult{
		StudentID: "alu4", Name: "Alumno 4", MoodleID: "204", Status: model.StudentExcluded,
		Score: model.Score{Total: 2, Status: model.ScoreExcluded},
	}
	dir := write(t, runWith(out))
	line := readJSON(t, filepath.Join(dir, "resume.json"))["cases"].([]any)[0].(map[string]any)

	if line["skip"] != true || line["grade"] != 0.0 || line["letter"] != "S" {
		t.Errorf("caso excluido: %v", line)
	}
	if conn := line["conn_status"].(map[string]any); len(conn) != 0 {
		t.Errorf("un alumno excluido no tiene avería: %v", conn)
	}
	if cfg := caseOf(t, dir, "01")["config"].(map[string]any); cfg["tt_skip"] != true {
		t.Errorf("tt_skip: %v", cfg["tt_skip"])
	}
}

// TestNoCredentialsInCaseConfig: Teuton dumped host1_password here. This does
// not, whatever the run carried.
func TestNoCredentialsInCaseConfig(t *testing.T) {
	dir := write(t, localRun())
	cfg := caseOf(t, dir, "01")["config"].(map[string]any)
	for key := range cfg {
		if key == "host1_password" || key == "host1_pass" {
			t.Errorf("el informe antiguo lleva credenciales: %s", key)
		}
	}
}
