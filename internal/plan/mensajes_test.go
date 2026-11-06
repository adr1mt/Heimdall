package plan

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A configuration error is read by the teacher, who does not read Go. These
// tests check the wording of every message, not only that it fails (T014).

const baseExam = `exam: "Prueba"
version: 1
hosts: [host1]
defaults:
  weight: 1
  timeout: 20s
groups:
  - group: "Uno"
    checks:
      - id: c1
        description: "Una comprobación"
        on: host1
        weight: 2
        timeout: 5s
        cmd: ["true"]
        value: "x"
        contains: "x"
        not_contains: "y"
        equals: "x"
        exit_code: 0
        near:
          anchor: "a"
          lines: 3
          contains: "b"
`

const baseInventory = `classroom: "Prueba"
version: 1
common:
  hosts:
    host1: { ip: "10.0.0.1", port: 22, user: "user", password_ref: "${AULA_PASSWORD}" }
  timeouts:
    connect: 5s
    student: 10m
students:
  - id: alumne01
    name: "Ana Ferrer"
    moodle_id: "1234"
    excluded: false
    hosts:
      host1: { ip: "10.0.0.2" }
`

// jargon is what must never reach the teacher: Go type names, YAML tags and
// the English of yaml.v3's own messages.
var jargon = []string{
	"!!", "plan.", "yaml:", "cannot", "unmarshal", "into", " type ",
	"string", "int", "float", "bool", "struct", "map[", "[]",
	"line ", "field", "error",
}

func TestMensajesDeTipoEquivocado(t *testing.T) {
	cases := []struct {
		name string
		old  string
		new  string
	}{
		// examen.yaml
		{"exam", `exam: "Prueba"`, "exam: [uno]"},
		{"version", "version: 1", "version: uno"},
		{"hosts", "hosts: [host1]", "hosts: host1"},
		{"defaults", "defaults:", "defaults: 3\nsobra:"},
		{"peso por defecto", "  weight: 1", "  weight: [1]"},
		{"timeout por defecto", "  timeout: 20s", "  timeout: 20"},
		{"groups", "groups:", "groups: 3\nsobra:"},
		{"group", `- group: "Uno"`, "- group: [uno]"},
		{"checks", "    checks:", "    checks: 3\n    sobra:"},
		{"id", "      - id: c1", "      - id: [c1]"},
		{"description", `description: "Una comprobación"`, "description: 3"},
		{"on", "on: host1", "on: [host1]"},
		{"weight", "weight: 2", "weight: hola"},
		{"timeout", "timeout: 5s", "timeout: [5s]"},
		{"cmd", `cmd: ["true"]`, "cmd: true"},
		{"value", `value: "x"`, "value: 3"},
		{"contains", `contains: "x"`, "contains: [x]"},
		{"not_contains", `not_contains: "y"`, "not_contains: [y]"},
		{"equals", `equals: "x"`, "equals: [x]"},
		{"exit_code", "exit_code: 0", "exit_code: cero"},
		{"near", "near:", "near: 3\n        sobra:"},
		{"anchor", `anchor: "a"`, "anchor: [a]"},
		{"lines", "lines: 3", "lines: tres"},
		{"contiene de cerca_de", `contains: "b"`, "contains: [b]"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			src := strings.Replace(baseExam, c.old, c.new, 1)
			if src == baseExam {
				t.Fatalf("el caso no modifica el examen base")
			}
			path := write(t, "examen.yaml", src)
			_, err := LoadExam(path)
			checkMessage(t, err, path)
		})
	}
}

func TestMensajesDeTipoEquivocadoEnAula(t *testing.T) {
	cases := []struct {
		name string
		old  string
		new  string
	}{
		{"aula", `classroom: "Prueba"`, "classroom: [uno]"},
		{"version", "version: 1", "version: uno"},
		{"common", "common:", "common: 3\nsobra:"},
		{"hosts de comun", "  hosts:", "  hosts: 3\n  sobra:"},
		{"host", `host1: { ip: "10.0.0.1", port: 22, user: "user", password_ref: "${AULA_PASSWORD}" }`, "host1: 3"},
		{"ip", `ip: "10.0.0.1"`, "ip: 10"},
		{"port", "port: 22", "port: veintidós"},
		{"user", `user: "user"`, "user: [usuario]"},
		{"password_ref", `password_ref: "${AULA_PASSWORD}"`, "password_ref: [x]"},
		{"timeouts", "  timeouts:", "  timeouts: 3\n  sobra:"},
		{"connect", "connect: 5s", "connect: 5"},
		{"alumno", "student: 10m", "student: [10m]"},
		{"students", "students:", "students: 3\nsobra:"},
		{"alumno suelto", "  - id: alumne01", "  - 3\n  - id: alumne01"},
		{"id", "  - id: alumne01", "  - id: [alumne01]"},
		{"name", `name: "Ana Ferrer"`, "name: [ana]"},
		{"moodle_id", `moodle_id: "1234"`, "moodle_id: [1234]"},
		{"excluded", "excluded: false", "excluded: quizá"},
		{"hosts del alumno", "    hosts:", "    hosts: 3\n    sobra:"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			src := strings.Replace(baseInventory, c.old, c.new, 1)
			if src == baseInventory {
				t.Fatalf("el caso no modifica el aula base")
			}
			path := write(t, "aula.yaml", src)
			_, err := LoadInventory(path)
			checkMessage(t, err, path)
		})
	}
}

// checkMessage requires an error that names the file and the line and says it
// in Spanish.
func checkMessage(t *testing.T, err error, path string) {
	t.Helper()
	if err == nil {
		t.Fatalf("se esperaba un error de configuración y no hubo ninguno")
	}
	for _, line := range strings.Split(err.Error(), "\n") {
		if !strings.HasPrefix(line, path+":") {
			t.Fatalf("el mensaje no empieza por fichero y línea: %q", line)
		}
		rest := strings.TrimPrefix(line, path+":")
		if i := strings.Index(rest, ": "); i <= 0 {
			t.Fatalf("el mensaje no lleva línea: %q", line)
		}
		for _, bad := range jargon {
			if strings.Contains(strings.ToLower(rest), bad) {
				t.Errorf("el mensaje contiene jerga %q: %q", bad, line)
			}
		}
	}
}

func write(t *testing.T, name, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}
