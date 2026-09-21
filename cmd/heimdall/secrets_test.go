package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The case this task exists for: an exam whose classroom asks for no password
// is corrected whole through the channel the GUI uses, which is always stdin.
func TestRunCorrectsAClassroomWithoutPasswordsThroughStdin(t *testing.T) {
	withStdin(t, strings.NewReader(`{"schema":1,"secrets":{}}`+"\n"))

	out := t.TempDir()
	var stdout, stderr bytes.Buffer
	if got := run([]string{"run", "--secrets=stdin", "--var=" + out, quizProject}, &stdout, &stderr); got != 0 {
		t.Fatalf("exit = %d, se esperaba 0 (%s)", got, stderr.String())
	}
	entries, err := os.ReadDir(out)
	if err != nil || len(entries) == 0 {
		t.Fatalf("no se escribió el artefacto: %v %v", entries, err)
	}
	artifact, err := os.ReadFile(filepath.Join(out, entries[0].Name()))
	if err != nil {
		t.Fatalf("no se pudo leer el artefacto: %s", err)
	}
	if !bytes.Contains(artifact, []byte(`"score"`)) {
		t.Errorf("el artefacto no trae la nota")
	}
}

// A classroom that does ask for a password and gets an empty envelope is a
// configuration error that names what is missing: exit 2, no machine dialled
// and nothing written.
func TestRunRejectsAnEmptyEnvelopeWhenTheClassroomAsksForAPassword(t *testing.T) {
	withStdin(t, strings.NewReader(`{"schema":1,"secrets":{}}`+"\n"))

	out := t.TempDir()
	var stdout, stderr bytes.Buffer
	if got := run([]string{"run", "--secrets=stdin", "--var=" + out, protoProject}, &stdout, &stderr); got != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d (%s)", got, exitInvalidConfig, stderr.String())
	}
	if !strings.Contains(stderr.String(), "AULA_PASSWORD") {
		t.Errorf("stderr = %q: debe nombrar la credencial que falta", stderr.String())
	}
	assertEmptyDir(t, out)
}
