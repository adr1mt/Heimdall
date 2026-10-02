package main

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// blockingReader never produces a byte: it stands for the teacher who forgot
// to pipe the secrets in.
type blockingReader struct{ done chan struct{} }

func (b blockingReader) Read([]byte) (int, error) {
	<-b.done
	return 0, io.EOF
}

// withStdin replaces the source of --secrets=stdin for one test.
func withStdin(t *testing.T, r io.Reader) {
	t.Helper()
	old := stdin
	stdin = r
	t.Cleanup(func() { stdin = old })
}

// Nothing arriving on stdin must end the run, not hang it in front of the
// class: exit 2 within a few seconds and no artifact.
func TestRunAbortsWhenNoSecretsArriveOnStdin(t *testing.T) {
	done := make(chan struct{})
	defer close(done)
	withStdin(t, blockingReader{done})

	out := t.TempDir()
	var stdout, stderr bytes.Buffer
	start := time.Now()
	got := run([]string{"run", "--secrets=stdin", "--var=" + out, protoProject}, &stdout, &stderr)
	elapsed := time.Since(start)

	if got != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d (%s)", got, exitInvalidConfig, stderr.String())
	}
	if elapsed < stdinReadTimeout || elapsed > stdinReadTimeout+3*time.Second {
		t.Errorf("tardó %s, se esperaba abortar alrededor de %s", elapsed, stdinReadTimeout)
	}
	if !strings.Contains(stderr.String(), "stdin") {
		t.Errorf("stderr = %q: debe decir que no llegó nada por stdin", stderr.String())
	}
	assertEmptyDir(t, out)
}

// A reference with no environment variable is a configuration error. Turning
// it into an empty password would send the whole class to UNEVALUATED and hide
// the real mistake (security rule 7).
func TestRunRejectsAReferenceWithoutVariable(t *testing.T) {
	t.Setenv("AULA_PASSWORD", "")
	out := t.TempDir()

	var stdout, stderr bytes.Buffer
	if got := run([]string{"run", "--secrets=env", "--var=" + out, protoProject}, &stdout, &stderr); got != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d", got, exitInvalidConfig)
	}
	msg := stderr.String()
	if !strings.Contains(msg, "AULA_PASSWORD") {
		t.Errorf("stderr = %q: debe nombrar la variable que falta", msg)
	}
	if strings.Contains(msg, "goroutine") || strings.Contains(msg, ".go:") {
		t.Errorf("stderr = %q: no puede llevar traza de pila", msg)
	}
	assertEmptyDir(t, out)
}

// An invalid PLAN stops before any machine and before any secret is read.
func TestRunRejectsAnInvalidPlan(t *testing.T) {
	out := t.TempDir()
	var stdout, stderr bytes.Buffer
	if got := run([]string{"run", "--var=" + out, "testdata/proyecto-invalido"}, &stdout, &stderr); got != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d", got, exitInvalidConfig)
	}
	if !strings.Contains(stderr.String(), "examen.yaml:7") {
		t.Errorf("stderr = %q: debe decir fichero y línea", stderr.String())
	}
	assertEmptyDir(t, out)
}

// The stdin document is a single JSON line with an explicit schema. A wrong
// schema or a malformed line is a configuration error, never a silent default.
// An envelope with no keys is not malformed: it is what a classroom that needs
// no password says, and engine.CheckSecrets is the one that decides whether
// that covers the PLAN.
func TestSecretsFromStdin(t *testing.T) {
	cases := []struct {
		name  string
		line  string
		want  string
		valid bool
	}{
		{"valid", `{"schema":1,"secrets":{"AULA_PASSWORD":"secreto-ficticio"}}` + "\n", "secreto-ficticio", true},
		{"no trailing newline", `{"schema":1,"secrets":{"AULA_PASSWORD":"secreto-ficticio"}}`, "secreto-ficticio", true},
		{"wrong schema", `{"schema":2,"secrets":{"AULA_PASSWORD":"x"}}`, "schema", false},
		{"not json", `AULA_PASSWORD=x`, "JSON", false},
		{"empty secrets", `{"schema":1,"secrets":{}}`, "", true},
		{"no secrets field", `{"schema":1}`, "", true},
		{"empty line", "\n", "no llegó ningún secreto", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			withStdin(t, strings.NewReader(tc.line))
			secrets, err := readSecrets("stdin", nil)
			if tc.valid {
				if err != nil {
					t.Fatalf("error inesperado: %v", err)
				}
				if secrets["AULA_PASSWORD"] != tc.want {
					t.Errorf("secreto = %q, want %q", secrets["AULA_PASSWORD"], tc.want)
				}
				return
			}
			if err == nil {
				t.Fatal("se esperaba un error")
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Errorf("error = %q, debe contener %q", err, tc.want)
			}
		})
	}
}

// Only the variables the inventory names are read: the engine must not pick up
// whatever else happens to be in the teacher's environment.
func TestSecretsFromEnvOnlyReadsTheNamedReferences(t *testing.T) {
	t.Setenv("AULA_PASSWORD", "secreto-ficticio")
	t.Setenv("OTRA_COSA", "no-me-toques")

	secrets, err := secretsFromEnv([]string{"AULA_PASSWORD"})
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if len(secrets) != 1 || secrets["AULA_PASSWORD"] != "secreto-ficticio" {
		t.Errorf("secretos = %v: solo debe traer AULA_PASSWORD", len(secrets))
	}
}

// An unknown channel is a usage error, not a run without credentials.
func TestRunRejectsAnUnknownSecretsChannel(t *testing.T) {
	out := t.TempDir()
	var stdout, stderr bytes.Buffer
	if got := run([]string{"run", "--secrets=fichero", "--var=" + out, protoProject}, &stdout, &stderr); got != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d", got, exitInvalidConfig)
	}
	if !strings.Contains(stderr.String(), "stdin o env") {
		t.Errorf("stderr = %q", stderr.String())
	}
}

// zero must leave nothing of the line that carried the password in memory.
func TestZeroWipesTheBuffer(t *testing.T) {
	b := []byte("secreto-ficticio")
	zero(b)
	for i, c := range b {
		if c != 0 {
			t.Fatalf("byte %d = %d, se esperaba 0", i, c)
		}
	}
}

func assertEmptyDir(t *testing.T, dir string) {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("leyendo %s: %v", dir, err)
	}
	if len(entries) != 0 {
		names := make([]string, 0, len(entries))
		for _, e := range entries {
			names = append(names, filepath.Base(e.Name()))
		}
		t.Errorf("%s debería estar vacío, contiene %v", dir, names)
	}
}

// The questionnaire project answers itself: no machine is contacted, so a run
// can be checked without the lab.
const quizProject = "../../testdata/cuestionario"

// The native stream has one format. Any other spelling is a mistake that must
// stop here and not end with the GUI waiting for a line that never comes.
func TestRunRejectsAnUnknownEventFormat(t *testing.T) {
	out := t.TempDir()
	var stdout, stderr bytes.Buffer
	if got := run([]string{"run", "--events=xml", "--var=" + out, protoProject}, &stdout, &stderr); got != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d", got, exitInvalidConfig)
	}
	if !strings.Contains(stderr.String(), "ndjson") {
		t.Errorf("stderr = %q: debe decir cuál es el formato", stderr.String())
	}
	assertEmptyDir(t, out)
}

func TestZeroWeightExamStopsBeforeWritingAndMixedExamIsReadable(t *testing.T) {
	dir := t.TempDir()
	out := t.TempDir()
	exam := "examen: Ficticio\nversion: 1\nhosts: []\npor_defecto: {peso: 0}\ngrupos:\n  - grupo: G\n    comprobaciones:\n      - id: zero\n        valor: yes\n        contiene: yes\n"
	os.WriteFile(filepath.Join(dir, "examen.yaml"), []byte(exam), 0600)
	os.WriteFile(filepath.Join(dir, "aula.yaml"), []byte("aula: Ficticia\nversion: 1\nalumnos:\n  - id: fake\n    nombre: Ficticio\n"), 0600)
	var stdout, stderr bytes.Buffer
	if code := run([]string{"run", "--secrets=env", "--var=" + out, dir}, &stdout, &stderr); code != exitInvalidConfig {
		t.Fatalf("zero exam exit %d: %s", code, stderr.String())
	}
	assertEmptyDir(t, out)
	exam += "      - id: positive\n        peso: 1\n        valor: yes\n        contiene: yes\n"
	os.WriteFile(filepath.Join(dir, "examen.yaml"), []byte(exam), 0600)
	stdout.Reset()
	stderr.Reset()
	if code := run([]string{"run", "--secrets=env", "--var=" + out, dir}, &stdout, &stderr); code != exitOK {
		t.Fatalf("mixed exam exit %d: %s", code, stderr.String())
	}
	paths, _ := filepath.Glob(filepath.Join(out, "run-*.json"))
	result, err := readArtifact(paths[0])
	if err != nil {
		t.Fatal(err)
	}
	if result.Students[0].Checks[0].Weight != 0 || *result.Students[0].Score.Final != 100 {
		t.Fatal("mixed grade changed")
	}
}
