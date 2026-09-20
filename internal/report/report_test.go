package report

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"heimdall/internal/model"
)

// runWith builds a minimal but complete artifact with the given students.
func runWith(id string, students ...model.StudentResult) *model.RunResult {
	return &model.RunResult{
		SchemaVersion: model.SchemaVersion,
		RunID:         id,
		EngineVersion: "test",
		StartedAt:     time.Date(2026, 9, 20, 10, 0, 0, 0, time.UTC),
		FinishedAt:    time.Date(2026, 9, 20, 10, 0, 5, 0, time.UTC),
		Status:        model.RunComplete,
		Plan:          model.PlanSummary{CheckCount: 1, TotalWeight: 1, CheckIDs: []string{"c1"}, Concurrency: 2},
		Students:      students,
	}
}

func student(id string, status model.StudentStatus) model.StudentResult {
	return model.StudentResult{
		StudentID: id,
		Name:      id,
		Status:    status,
		Score:     model.Score{Total: 1, Unevaluated: 1, Status: model.ScoreNotEvaluated},
		Checks: []model.CheckResult{{
			CheckID: "c1", Weight: 1,
			Status: model.Unevaluated, Cause: model.CauseConnectFailed,
		}},
	}
}

func TestWriteFinalAndLatest(t *testing.T) {
	dir := t.TempDir()
	w, err := New(dir, "01J0RUNAAAAAAAAAAAAAAAAAAA", nil)
	if err != nil {
		t.Fatal(err)
	}
	path, err := w.WriteFinal(runWith(w.runID, student("alumne01", model.StudentOK)))
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(path) != "run-01J0RUNAAAAAAAAAAAAAAAAAAA.json" {
		t.Errorf("nombre inesperado: %s", path)
	}
	target, err := os.Readlink(filepath.Join(dir, "latest.json"))
	if err != nil {
		t.Fatalf("latest.json: %v", err)
	}
	if target != filepath.Base(path) {
		t.Errorf("latest.json apunta a %q", target)
	}
	assertValidArtifact(t, path, 1)
	assertNoLeftovers(t, dir)
}

// TestArtifactIsWrittenWhenEveryStudentFails is the acceptance criterion that
// a run where nothing could be evaluated still leaves evidence.
func TestArtifactIsWrittenWhenEveryStudentFails(t *testing.T) {
	dir := t.TempDir()
	w, _ := New(dir, "01J0RUNBBBBBBBBBBBBBBBBBBB", nil)
	run := runWith(w.runID,
		student("alumne01", model.StudentNotEvaluated),
		student("alumne02", model.StudentNotEvaluated))
	run.Status = model.RunPartial

	path, err := w.WriteFinal(run)
	if err != nil {
		t.Fatal(err)
	}
	assertValidArtifact(t, path, 2)
}

func TestPartialIsReplacedByFinal(t *testing.T) {
	dir := t.TempDir()
	w, _ := New(dir, "01J0RUNCCCCCCCCCCCCCCCCCCC", nil)
	if err := w.WritePartial(runWith(w.runID, student("alumne01", model.StudentOK))); err != nil {
		t.Fatal(err)
	}
	assertValidArtifact(t, w.PartialPath(), 1)

	if _, err := w.WriteFinal(runWith(w.runID,
		student("alumne01", model.StudentOK), student("alumne02", model.StudentOK))); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(w.PartialPath()); !os.IsNotExist(err) {
		t.Errorf("el parcial sigue ahí: %v", err)
	}
	assertNoLeftovers(t, dir)
}

// TestConcurrentRunsDoNotCollide covers F-13: two runs writing into the same
// var/ at the same time must leave two complete files.
func TestConcurrentRunsDoNotCollide(t *testing.T) {
	dir := t.TempDir()
	const runs = 8

	ids := make([]string, runs)
	for i := range ids {
		id, err := NewRunID()
		if err != nil {
			t.Fatal(err)
		}
		ids[i] = id
	}

	var wg sync.WaitGroup
	errs := make([]error, runs)
	for i, id := range ids {
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			w, err := New(dir, id, nil)
			if err != nil {
				errs[i] = err
				return
			}
			run := runWith(id, student("alumne01", model.StudentOK))
			if err := w.WritePartial(run); err != nil {
				errs[i] = err
				return
			}
			_, errs[i] = w.WriteFinal(run)
		}(i, id)
	}
	wg.Wait()

	seen := map[string]bool{}
	for i, err := range errs {
		if err != nil {
			t.Fatalf("ejecución %d: %v", i, err)
		}
		if seen[ids[i]] {
			t.Fatalf("identificador repetido: %s", ids[i])
		}
		seen[ids[i]] = true
		assertValidArtifact(t, filepath.Join(dir, "run-"+ids[i]+".json"), 1)
	}
	assertNoLeftovers(t, dir)
}

// TestPartialSurvivesSIGKILL covers F-16: a run killed outright still leaves
// a readable partial with the students it had already finished.
func TestPartialSurvivesSIGKILL(t *testing.T) {
	if os.Getenv("HEIMDALL_SUICIDE_DIR") != "" {
		dir := os.Getenv("HEIMDALL_SUICIDE_DIR")
		w, err := New(dir, "01J0RUNDDDDDDDDDDDDDDDDDDD", nil)
		if err != nil {
			os.Exit(1)
		}
		if err := w.WritePartial(runWith(w.runID, student("alumne01", model.StudentOK))); err != nil {
			os.Exit(1)
		}
		// Killed by the operating system, with no chance to clean up.
		if err := syscallKillSelf(); err != nil {
			os.Exit(1)
		}
		select {} // unreachable once the signal lands
	}

	dir := t.TempDir()
	cmd := exec.Command(os.Args[0], "-test.run", "TestPartialSurvivesSIGKILL")
	cmd.Env = append(os.Environ(), "HEIMDALL_SUICIDE_DIR="+dir)
	err := cmd.Run()
	if err == nil {
		t.Fatal("el subproceso terminó normalmente: no se le mató")
	}
	assertValidArtifact(t, filepath.Join(dir, "run-01J0RUNDDDDDDDDDDDDDDDDDDD.partial.json"), 1)
	assertNoLeftovers(t, dir)
}

// TestSecretIsRedacted covers the second line of defence: a secret that
// somehow reached the output is replaced and reported.
func TestSecretIsRedacted(t *testing.T) {
	dir := t.TempDir()
	const secret = "s3cr3t-de-prueba"
	w, _ := New(dir, "01J0RUNEEEEEEEEEEEEEEEEEEE", []string{secret})

	run := runWith(w.runID, student("alumne01", model.StudentOK))
	code := 1
	run.Students[0].Checks[0].Execution = &model.ExecutionResult{
		Completed: true,
		ExitCode:  &code,
		Command:   []string{"echo", "hola"},
		Stderr:    model.Stream{Text: "sshpass: bad password " + secret + "\n"},
	}
	run.Students[0].Checks[0].Detail = "falló con " + secret

	path, err := w.WriteFinal(run)
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), secret) {
		t.Fatal("la contraseña aparece en el artefacto")
	}
	if !strings.Contains(string(data), Redacted) {
		t.Error("no aparece la marca de redacción")
	}

	var got model.RunResult
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatal(err)
	}
	var warned bool
	for _, warn := range got.Warnings {
		if warn.Code == WarnSecretRedacted {
			warned = true
		}
	}
	if !warned {
		t.Error("se redactó sin avisar")
	}
	// The caller's own copy must be untouched: the engine keeps working with
	// what it actually collected.
	if !strings.Contains(run.Students[0].Checks[0].Detail, secret) {
		t.Error("redact modificó el artefacto original")
	}
}

func TestNewRunIDIsSortableAndUnique(t *testing.T) {
	seen := map[string]bool{}
	var prev string
	for i := 0; i < 200; i++ {
		id, err := NewRunID()
		if err != nil {
			t.Fatal(err)
		}
		if len(id) != 26 {
			t.Fatalf("longitud %d: %q", len(id), id)
		}
		if seen[id] {
			t.Fatalf("identificador repetido: %s", id)
		}
		seen[id] = true
		prev = id
	}
	later, _ := newRunIDAt(time.Now().Add(time.Hour))
	if later <= prev {
		t.Errorf("un identificador posterior no ordena después: %s <= %s", later, prev)
	}
}

func assertValidArtifact(t *testing.T, path string, students int) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("leer %s: %v", path, err)
	}
	var run model.RunResult
	if err := json.Unmarshal(data, &run); err != nil {
		t.Fatalf("%s no es JSON válido: %v", path, err)
	}
	if len(run.Students) != students {
		t.Fatalf("%s tiene %d alumnos, se esperaban %d", path, len(run.Students), students)
	}
	for _, st := range run.Students {
		if st.StudentID == "" || len(st.Checks) == 0 {
			t.Fatalf("%s: alumno incompleto %+v", path, st)
		}
	}
}

// assertNoLeftovers checks that no temporary file survived: the directory
// holds artifacts and the latest.json link, nothing else.
func assertNoLeftovers(t *testing.T, dir string) {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".tmp-") || strings.HasSuffix(e.Name(), ".tmp") {
			t.Errorf("quedó un temporal: %s", e.Name())
		}
	}
}
