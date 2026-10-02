package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"heimdall/internal/model"
)

// The chain on disk, as the engine leaves it: two files, the newest naming
// the one it repeated.

func chainDay(day int) time.Time {
	return time.Date(2026, 9, day, 10, 0, 0, 0, time.UTC)
}

func chainCheckOf(id string, weight float64, status model.AcademicStatus) model.CheckResult {
	cause := model.CauseNone
	if status == model.Unevaluated {
		cause = model.CauseConnectFailed
	}
	check := model.CheckResult{CheckID: id, Weight: weight, Status: status, Cause: cause}
	if status != model.Unevaluated {
		zero := 0
		check.Execution = &model.ExecutionResult{Completed: true, ExitCode: &zero, RemoteProcess: model.RemoteFinished, Transport: "inventory", StartedAt: chainDay(15)}
		check.Assertion = &model.AssertionResult{Kind: "exit_code", Matched: status == model.Pass}
	}
	return check
}

func chainStudentOf(id string, day int, checks ...model.CheckResult) model.StudentResult {
	plan := model.PlanSummary{CheckCount: 2, TotalWeight: 10, CheckIDs: []string{"c1", "c2"}}
	return model.StudentResult{
		StudentID: id, Name: id,
		Status:     model.StudentStatusOf(checks),
		StartedAt:  chainDay(day),
		FinishedAt: chainDay(day),
		Score:      model.ComputeScore(plan, checks),
		Checks:     checks,
	}
}

func chainRunOf(id string, day int, students ...model.StudentResult) *model.RunResult {
	return &model.RunResult{
		SchemaVersion: model.SchemaVersion,
		RunID:         id,
		EngineVersion: "test",
		Exam:          model.SourceRef{Path: "examen.yaml", SHA256: "hash"}, Inventory: model.SourceRef{Path: "aula.yaml", SHA256: "hash"},
		StartedAt:  chainDay(day),
		FinishedAt: chainDay(day),
		Status:     model.RunStatusOf(students),
		PlanHash:   "hash-del-plan",
		Plan:       model.PlanSummary{CheckCount: 2, TotalWeight: 10, CheckIDs: []string{"c1", "c2"}, Concurrency: 16, HostConcurrency: 4},
		Students:   students,
	}
}

func writeRun(t *testing.T, dir, name string, run *model.RunResult) string {
	t.Helper()
	data, err := model.MarshalCanonical(run)
	if err != nil {
		t.Fatalf("MarshalCanonical: %v", err)
	}
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	return path
}

// writeChain leaves Tuesday and Wednesday on disk and returns the newest.
func writeChain(t *testing.T, dir string, second *model.RunResult) string {
	t.Helper()
	first := chainRunOf("RUN-MARTES", 15,
		chainStudentOf("alumne01", 15, chainCheckOf("c1", 6, model.Pass), chainCheckOf("c2", 4, model.Fail)),
		chainStudentOf("alumne02", 15, chainCheckOf("c1", 6, model.Unevaluated), chainCheckOf("c2", 4, model.Unevaluated)),
	)
	firstPath := writeRun(t, dir, "run-martes.json", first)
	second.RetryOf = &model.RetryRef{
		RunID: first.RunID, Artifact: firstPath, RunAt: first.FinishedAt, Students: 1, Checks: 2,
	}
	return writeRun(t, dir, "run-miercoles.json", second)
}

func consolidated(t *testing.T, path string) (*model.Consolidation, int, string) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	code := run([]string{"consolidate", path}, &stdout, &stderr)
	if stdout.Len() == 0 {
		return nil, code, stderr.String()
	}
	var out model.Consolidation
	if err := json.Unmarshal(stdout.Bytes(), &out); err != nil {
		t.Fatalf("la consolidación no es JSON válido: %v\n%s", err, stdout.String())
	}
	return &out, code, stderr.String()
}

func studentIn(t *testing.T, c *model.Consolidation, id string) model.ConsolidatedStudent {
	t.Helper()
	for _, s := range c.Students {
		if s.StudentID == id {
			return s
		}
	}
	t.Fatalf("%s no aparece en la consolidación", id)
	return model.ConsolidatedStudent{}
}

// A student finished between two runs gets a final grade, and the command
// says so with exit 0.
func TestConsolidateCmdClosesTheChain(t *testing.T) {
	dir := t.TempDir()
	path := writeChain(t, dir, chainRunOf("RUN-MIERCOLES", 16,
		chainStudentOf("alumne02", 16, chainCheckOf("c1", 6, model.Pass), chainCheckOf("c2", 4, model.Pass)),
	))

	out, code, stderr := consolidated(t, path)
	if out == nil {
		t.Fatalf("no se imprimió nada; stderr: %s", stderr)
	}
	if code != exitOK {
		t.Errorf("exit = %d, want %d: no queda nada sin evaluar", code, exitOK)
	}
	two := studentIn(t, out, "alumne02")
	if two.Score.Final == nil || *two.Score.Final != 100 {
		t.Fatalf("final_score de alumne02 = %v, want 100", two.Score.Final)
	}
	if two.Checks[0].FromRun != "RUN-MIERCOLES" || len(two.Checks[0].Attempts) != 1 {
		t.Errorf("c1 no dice de dónde sale ni qué se intentó antes: %+v", two.Checks[0])
	}
	if len(out.Runs) != 2 || out.Runs[1].Artifact == "" {
		t.Errorf("la cadena no nombra los dos ficheros: %+v", out.Runs)
	}
}

// While something is still unevaluated in the whole chain there is no final
// grade, and the exit code says the run is still partial.
func TestConsolidateCmdPartialChain(t *testing.T) {
	dir := t.TempDir()
	path := writeChain(t, dir, chainRunOf("RUN-MIERCOLES", 16,
		chainStudentOf("alumne02", 16, chainCheckOf("c1", 6, model.Pass), chainCheckOf("c2", 4, model.Unevaluated)),
	))

	out, code, _ := consolidated(t, path)
	if code != exitPartial {
		t.Errorf("exit = %d, want %d: queda una comprobación sin evaluar", code, exitPartial)
	}
	if got := studentIn(t, out, "alumne02"); got.Score.Final != nil {
		t.Errorf("final_score = %d; falta una comprobación por evaluar", *got.Score.Final)
	}
}

// A chain with another PLAN is refused, with the reason and without printing
// anything that could be read as a result.
func TestConsolidateCmdRefusesAnotherPlan(t *testing.T) {
	dir := t.TempDir()
	second := chainRunOf("RUN-MIERCOLES", 16,
		chainStudentOf("alumne02", 16, chainCheckOf("c1", 6, model.Pass), chainCheckOf("c2", 4, model.Pass)),
	)
	second.PlanHash = "otro-hash"
	path := writeChain(t, dir, second)

	var stdout, stderr bytes.Buffer
	code := run([]string{"consolidate", path}, &stdout, &stderr)
	if code != exitInvalidConfig {
		t.Errorf("exit = %d, want %d", code, exitInvalidConfig)
	}
	if stdout.Len() != 0 {
		t.Errorf("se imprimió una consolidación de dos PLAN distintos:\n%s", stdout.String())
	}
	if !strings.Contains(stderr.String(), "denominador") {
		t.Errorf("el error no explica por qué: %s", stderr.String())
	}
}

// A missing link is not consolidated as if it never existed: it stops.
func TestConsolidateCmdMissingLink(t *testing.T) {
	dir := t.TempDir()
	path := writeChain(t, dir, chainRunOf("RUN-MIERCOLES", 16,
		chainStudentOf("alumne02", 16, chainCheckOf("c1", 6, model.Pass), chainCheckOf("c2", 4, model.Pass)),
	))
	if err := os.Remove(filepath.Join(dir, "run-martes.json")); err != nil {
		t.Fatalf("Remove: %v", err)
	}

	var stdout, stderr bytes.Buffer
	if code := run([]string{"consolidate", path}, &stdout, &stderr); code != exitInvalidConfig {
		t.Errorf("exit = %d, want %d", code, exitInvalidConfig)
	}
	if stdout.Len() != 0 {
		t.Errorf("se consolidó media cadena:\n%s", stdout.String())
	}
	if !strings.Contains(stderr.String(), "run-martes.json") {
		t.Errorf("el error no dice qué fichero falta: %s", stderr.String())
	}
}

// A project copied to another folder keeps its chain: the previous artifact is
// looked for next to the one being read.
func TestConsolidateCmdFindsTheChainAfterAMove(t *testing.T) {
	origin := t.TempDir()
	writeChain(t, origin, chainRunOf("RUN-MIERCOLES", 16,
		chainStudentOf("alumne02", 16, chainCheckOf("c1", 6, model.Pass), chainCheckOf("c2", 4, model.Pass)),
	))

	moved := t.TempDir()
	for _, name := range []string{"run-martes.json", "run-miercoles.json"} {
		data, err := os.ReadFile(filepath.Join(origin, name))
		if err != nil {
			t.Fatalf("ReadFile: %v", err)
		}
		if err := os.WriteFile(filepath.Join(moved, name), data, 0o600); err != nil {
			t.Fatalf("WriteFile: %v", err)
		}
	}
	if err := os.RemoveAll(origin); err != nil {
		t.Fatalf("RemoveAll: %v", err)
	}

	out, code, stderr := consolidated(t, filepath.Join(moved, "run-miercoles.json"))
	if out == nil {
		t.Fatalf("no se consolidó la cadena movida; stderr: %s", stderr)
	}
	if code != exitOK {
		t.Errorf("exit = %d, want %d", code, exitOK)
	}
}

// A single run is a chain of one, and consolidating it changes no grade.
func TestConsolidateCmdOneRun(t *testing.T) {
	dir := t.TempDir()
	only := chainRunOf("RUN-UNICO", 15,
		chainStudentOf("alumne01", 15, chainCheckOf("c1", 6, model.Pass), chainCheckOf("c2", 4, model.Fail)),
	)
	path := writeRun(t, dir, "run-unico.json", only)

	out, code, _ := consolidated(t, path)
	if code != exitOK {
		t.Errorf("exit = %d, want %d", code, exitOK)
	}
	got := studentIn(t, out, "alumne01")
	if got.Score.Final == nil || *got.Score.Final != *only.Students[0].Score.Final {
		t.Errorf("la nota cambia al consolidar una sola corrección: %v vs %v",
			got.Score.Final, only.Students[0].Score.Final)
	}
}

// It writes nothing: the artifacts of the chain are left exactly as they were.
func TestConsolidateCmdWritesNothing(t *testing.T) {
	dir := t.TempDir()
	path := writeChain(t, dir, chainRunOf("RUN-MIERCOLES", 16,
		chainStudentOf("alumne02", 16, chainCheckOf("c1", 6, model.Pass), chainCheckOf("c2", 4, model.Pass)),
	))

	before := map[string]string{}
	names, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	for _, entry := range names {
		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			t.Fatalf("ReadFile: %v", err)
		}
		before[entry.Name()] = string(data)
	}

	var stdout, stderr bytes.Buffer
	run([]string{"consolidate", path}, &stdout, &stderr)

	after, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	if len(after) != len(before) {
		t.Fatalf("la carpeta pasó de %d ficheros a %d", len(before), len(after))
	}
	for _, entry := range after {
		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			t.Fatalf("ReadFile: %v", err)
		}
		if string(data) != before[entry.Name()] {
			t.Errorf("%s cambió al consolidar", entry.Name())
		}
	}
}
