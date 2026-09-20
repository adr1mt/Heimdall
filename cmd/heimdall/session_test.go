package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"testing"

	"heimdall/internal/model"
)

// The session as the teacher has it on disk: one artifact per round, and a
// subcommand that reads them together without touching any of them.

// sessionRun is one round: the student with `pass`ing weight out of the ten of
// the plan, and `unevaluated` telling whether their machine answered at all.
func sessionRun(id string, day int, student string, first, second model.AcademicStatus) *model.RunResult {
	return chainRunOf(id, day, chainStudentOf(student, day,
		chainCheckOf("c1", 6, first), chainCheckOf("c2", 4, second)))
}

// dirState is the directory as it stands, so a test can prove nothing was
// written, changed or removed.
func dirState(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	out := []string{}
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			t.Fatalf("Info: %v", err)
		}
		out = append(out, fmt.Sprintf("%s %s %d", e.Name(), info.ModTime(), info.Size()))
	}
	sort.Strings(out)
	return out
}

func sessionOf(t *testing.T, args ...string) (*model.Session, int, string) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	code := run(append([]string{"session"}, args...), &stdout, &stderr)
	if stdout.Len() == 0 {
		return nil, code, stderr.String()
	}
	var out model.Session
	if err := json.Unmarshal(stdout.Bytes(), &out); err != nil {
		t.Fatalf("la salida no es una sesión: %v\n%s", err, stdout.String())
	}
	return &out, code, stderr.String()
}

// The view comes out of stdout with its own kind, and not one file is written
// or touched (ADR-0020 §7).
func TestSessionIsPrintedAndWritesNothing(t *testing.T) {
	dir := t.TempDir()
	r1 := writeRun(t, dir, "run-1.json", sessionRun("R1", 15, "alumne01", model.Pass, model.Fail))
	r2 := writeRun(t, dir, "run-2.json", sessionRun("R2", 16, "alumne01", model.Pass, model.Pass))
	before := dirState(t, dir)

	got, code, stderr := sessionOf(t, r1, r2)
	if code != exitOK {
		t.Fatalf("exit = %d, se esperaba %d (%s)", code, exitOK, stderr)
	}
	if got.Kind != "session" || got.Version != model.SessionVersion {
		t.Errorf("kind = %q versión = %d: una sesión no se puede leer como otra cosa", got.Kind, got.Version)
	}
	if len(got.Rounds) != 2 || got.Rounds[0].RunID != "R1" || got.Rounds[1].RunID != "R2" {
		t.Errorf("vueltas = %+v, se esperaban R1 y R2 en ese orden", got.Rounds)
	}

	s := got.Students[0]
	if s.Score.Final == nil || *s.Score.Final != 100 {
		t.Errorf("nota = %v, se esperaba 100", s.Score.Final)
	}
	if s.FromRound != 2 || s.Status != model.SessionFinished {
		t.Errorf("de la vuelta %d y estado %s, se esperaba vuelta 2 y %s", s.FromRound, s.Status, model.SessionFinished)
	}

	if after := dirState(t, dir); !reflect.DeepEqual(before, after) {
		t.Errorf("el directorio cambió:\n%v\n%v", before, after)
	}
}

// Rounds of another exam do not form a session, and the message says which one
// does not fit (ADR-0020 §5).
func TestSessionRejectsARoundOfAnotherExam(t *testing.T) {
	dir := t.TempDir()
	r1 := writeRun(t, dir, "run-1.json", sessionRun("R1", 15, "alumne01", model.Pass, model.Pass))
	other := sessionRun("R2", 16, "alumne01", model.Pass, model.Pass)
	other.PlanHash = "hash-de-otro-examen"
	r2 := writeRun(t, dir, "run-2.json", other)

	_, code, stderr := sessionOf(t, r1, r2)
	if code != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d", code, exitInvalidConfig)
	}
	if !bytes.Contains([]byte(stderr), []byte("R2")) {
		t.Errorf("stderr = %q: tiene que decir cuál no encaja", stderr)
	}
}

// A round that cannot be read stops the whole thing: half a session would say
// that the best round was one that is not even there.
func TestSessionRejectsARoundItCannotRead(t *testing.T) {
	dir := t.TempDir()
	r1 := writeRun(t, dir, "run-1.json", sessionRun("R1", 15, "alumne01", model.Pass, model.Pass))

	_, code, stderr := sessionOf(t, r1, filepath.Join(dir, "no-existe.json"))
	if code != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d", code, exitInvalidConfig)
	}
	if !bytes.Contains([]byte(stderr), []byte("no-existe.json")) {
		t.Errorf("stderr = %q: tiene que nombrar el fichero", stderr)
	}
}

// Somebody without a single whole round has no session grade, and the exit
// code says so the same way a run does.
func TestSessionIsPartialWhileSomebodyHasNoWholeRound(t *testing.T) {
	dir := t.TempDir()
	r1 := writeRun(t, dir, "run-1.json", sessionRun("R1", 15, "alumne01", model.Pass, model.Unevaluated))

	got, code, stderr := sessionOf(t, r1)
	if code != exitPartial {
		t.Fatalf("exit = %d, se esperaba %d (%s)", code, exitPartial, stderr)
	}
	s := got.Students[0]
	if s.FromRound != 0 || s.Score.Final != nil {
		t.Errorf("nota = %v de la vuelta %d: sin ninguna vuelta entera no hay nota de sesión", s.Score.Final, s.FromRound)
	}
	if s.Reason == "" {
		t.Error("tiene que decir por qué todavía no tiene nota, nunca un cero")
	}
}

// The same round twice is a mistake of composition, not two rounds.
func TestSessionRejectsTheSameRoundTwice(t *testing.T) {
	dir := t.TempDir()
	r1 := writeRun(t, dir, "run-1.json", sessionRun("R1", 15, "alumne01", model.Pass, model.Pass))

	_, code, stderr := sessionOf(t, r1, r1)
	if code != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d (%s)", code, exitInvalidConfig, stderr)
	}
}

// Without any round there is nothing to read.
func TestSessionNeedsAtLeastOneRound(t *testing.T) {
	if _, code, _ := sessionOf(t); code != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d", code, exitInvalidConfig)
	}
}
