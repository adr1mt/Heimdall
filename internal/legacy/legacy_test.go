package legacy

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"heimdall/internal/model"
)

// goldenDir holds three real Teuton 2.10.6 reports. The projection is right
// when the GUI reads the same values out of ours.
const goldenDir = "../../testdata/legacy"

func ptr[T any](v T) *T { return &v }

// localRun mirrors the run that produced the golden files: three students,
// two checks of weight 1, Ana and Luis pass both and Eva fails the first.
func localRun() *model.RunResult {
	at := time.Date(2026, 9, 16, 20, 45, 36, 0, time.FixedZone("CEST", 2*3600))
	check := func(id, desc, expected string, args []string, out string, pass bool) model.CheckResult {
		status := model.Fail
		if pass {
			status = model.Pass
		}
		return model.CheckResult{
			CheckID: id, Group: "Local", Description: desc, Weight: 1,
			Status: status, Cause: model.CauseNone,
			Execution: &model.ExecutionResult{
				Host: "local", Address: "127.1.2.3:2201", User: "alumno",
				Transport: "inventory", Command: args, DurationMS: 2,
				Completed: true, ExitCode: ptr(0),
				Stdout: model.Stream{Text: out},
			},
			Assertion: &model.AssertionResult{Kind: "contains", Expected: expected, Matched: pass},
		}
	}
	student := func(id, name, moodle string, first bool) model.StudentResult {
		obtained := 2.0
		if !first {
			obtained = 1
		}
		return model.StudentResult{
			StudentID: id, Name: name, MoodleID: moodle, Status: model.StudentOK,
			StartedAt: at, FinishedAt: at,
			Score: model.Score{
				Obtained: obtained, Evaluable: 2, Total: 2,
				Provisional: ptr(int(obtained * 50)), Final: ptr(int(obtained * 50)),
				Status: model.ScoreComplete,
			},
			Checks: []model.CheckResult{
				check("flag", "Existe el fichero del alumno", "si",
					[]string{"test", "-f", "/tmp/" + name + ".flag"}, map[bool]string{true: "si", false: "no"}[first], first),
				check("echo", "Echo", "hola", []string{"echo", "hola"}, "hola", true),
			},
		}
	}
	return &model.RunResult{
		StartedAt: at, FinishedAt: at, Status: model.RunComplete,
		Plan: model.PlanSummary{CheckCount: 2, TotalWeight: 2},
		Students: []model.StudentResult{
			student("ana", "Ana", "101", true),
			student("luis", "Luis", "102", true),
			student("eva", "Eva", "103", false),
		},
	}
}

func write(t *testing.T, run *model.RunResult) string {
	t.Helper()
	dir := t.TempDir()
	w, err := New(dir, "proj")
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Write(run); err != nil {
		t.Fatal(err)
	}
	return w.Dir()
}

func readJSON(t *testing.T, path string) map[string]any {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("%s: %s", path, err)
	}
	return out
}

// TestResumeMatchesGolden compares resume.json field by field on everything
// the GUI reads in main/results.ts: id, members, grade, letter, moodle_id,
// skip and conn_status.
func TestResumeMatchesGolden(t *testing.T) {
	got := readJSON(t, filepath.Join(write(t, localRun()), "resume.json"))
	want := readJSON(t, filepath.Join(goldenDir, "resume.json"))

	gotCases := got["cases"].([]any)
	wantCases := want["cases"].([]any)
	if len(gotCases) != len(wantCases) {
		t.Fatalf("casos: %d, se esperaban %d", len(gotCases), len(wantCases))
	}
	for i := range wantCases {
		g := gotCases[i].(map[string]any)
		w := wantCases[i].(map[string]any)
		for _, key := range []string{"id", "members", "grade", "moodle_id", "skip"} {
			if g[key] != w[key] {
				t.Errorf("caso %d, %s: %v, se esperaba %v", i+1, key, g[key], w[key])
			}
		}
		// Teuton wrote "✔" for a 100 and nothing at all for a 50, where the
		// GUI falls back to "?". Ours says it out loud.
		wantLetter := "?"
		if w["letter"] == "✔" {
			wantLetter = "✓"
		}
		if g["letter"] != wantLetter {
			t.Errorf("caso %d, letter: %v, se esperaba %v", i+1, g["letter"], wantLetter)
		}
		if conn := g["conn_status"].(map[string]any); len(conn) != 0 {
			t.Errorf("caso %d: conn_status no vacío en una ejecución sin averías: %v", i+1, conn)
		}
	}
	if cfg := got["config"].(map[string]any); cfg["tt_testname"] != "proj" {
		t.Errorf("tt_testname: %v", cfg["tt_testname"])
	}
}

// TestCaseMatchesGolden compares each case-NN.json on the fields the GUI
// reads per target and in results.
func TestCaseMatchesGolden(t *testing.T) {
	dir := write(t, localRun())
	for _, name := range []string{"case-01.json", "case-02.json", "case-03.json"} {
		got := readJSON(t, filepath.Join(dir, name))
		want := readJSON(t, filepath.Join(goldenDir, name))

		gotCfg := got["config"].(map[string]any)
		wantCfg := want["config"].(map[string]any)
		for _, key := range []string{"tt_testname", "tt_members", "tt_moodle_id", "tt_skip"} {
			if gotCfg[key] != wantCfg[key] {
				t.Errorf("%s config.%s: %v, se esperaba %v", name, key, gotCfg[key], wantCfg[key])
			}
		}

		gotTargets := targetsOf(t, got)
		wantTargets := targetsOf(t, want)
		if len(gotTargets) != len(wantTargets) {
			t.Fatalf("%s: %d targets, se esperaban %d", name, len(gotTargets), len(wantTargets))
		}
		for i := range wantTargets {
			for _, key := range []string{"target_id", "check", "score", "weight", "description", "conn_type", "output", "result"} {
				if gotTargets[i][key] != wantTargets[i][key] {
					t.Errorf("%s target %d, %s: %v, se esperaba %v", name, i+1, key, gotTargets[i][key], wantTargets[i][key])
				}
			}
		}

		gotRes := got["results"].(map[string]any)
		wantRes := want["results"].(map[string]any)
		for _, key := range []string{"case_id", "grade", "max_weight", "good_weight", "fail_weight", "fail_counter", "unique_fault"} {
			if gotRes[key] != wantRes[key] {
				t.Errorf("%s results.%s: %v, se esperaba %v", name, key, gotRes[key], wantRes[key])
			}
		}
	}
}

func targetsOf(t *testing.T, report map[string]any) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, g := range report["groups"].([]any) {
		for _, target := range g.(map[string]any)["targets"].([]any) {
			out = append(out, target.(map[string]any))
		}
	}
	return out
}

func TestMoodleCSVMatchesGolden(t *testing.T) {
	got, err := os.ReadFile(filepath.Join(write(t, localRun()), "moodle.csv"))
	if err != nil {
		t.Fatal(err)
	}
	want := "MoodleID,TeutonGrade,TeutonFeedback\n" +
		"101,100.0,\"Filename: case-01. Date: 2026-09-16 20:45:36 +0200\"\n" +
		"102,100.0,\"Filename: case-02. Date: 2026-09-16 20:45:36 +0200\"\n" +
		"103,50.0,\"Filename: case-03. Date: 2026-09-16 20:45:36 +0200\"\n"
	if string(got) != want {
		t.Errorf("moodle.csv:\n%s\nse esperaba:\n%s", got, want)
	}
}
