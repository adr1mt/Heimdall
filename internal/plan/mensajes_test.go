package plan

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A configuration error is read by the teacher, who does not read Go. These
// tests check the wording of every message, not only that it fails (T014).

const baseExam = `examen: "Prueba"
version: 1
hosts: [host1]
por_defecto:
  peso: 1
  timeout: 20s
grupos:
  - grupo: "Uno"
    comprobaciones:
      - id: c1
        descripcion: "Una comprobación"
        en: host1
        peso: 2
        timeout: 5s
        cmd: ["true"]
        valor: "x"
        contiene: "x"
        no_contiene: "y"
        igual_a: "x"
        exit_code: 0
        cerca_de:
          ancla: "a"
          lineas: 3
          contiene: "b"
`

const baseInventory = `aula: "Prueba"
version: 1
comun:
  hosts:
    host1: { ip: "10.0.0.1", puerto: 22, usuario: "usuario", password_ref: "${AULA_PASSWORD}" }
  timeouts:
    conexion: 5s
    alumno: 10m
alumnos:
  - id: alumne01
    nombre: "Ana Ferrer"
    moodle_id: "1234"
    excluido: false
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
		{"examen", `examen: "Prueba"`, "examen: [uno]"},
		{"version", "version: 1", "version: uno"},
		{"hosts", "hosts: [host1]", "hosts: host1"},
		{"por_defecto", "por_defecto:", "por_defecto: 3\nsobra:"},
		{"peso por defecto", "  peso: 1", "  peso: [1]"},
		{"timeout por defecto", "  timeout: 20s", "  timeout: 20"},
		{"grupos", "grupos:", "grupos: 3\nsobra:"},
		{"grupo", `- grupo: "Uno"`, "- grupo: [uno]"},
		{"comprobaciones", "    comprobaciones:", "    comprobaciones: 3\n    sobra:"},
		{"id", "      - id: c1", "      - id: [c1]"},
		{"descripcion", `descripcion: "Una comprobación"`, "descripcion: 3"},
		{"en", "en: host1", "en: [host1]"},
		{"peso", "peso: 2", "peso: hola"},
		{"timeout", "timeout: 5s", "timeout: [5s]"},
		{"cmd", `cmd: ["true"]`, "cmd: true"},
		{"valor", `valor: "x"`, "valor: 3"},
		{"contiene", `contiene: "x"`, "contiene: [x]"},
		{"no_contiene", `no_contiene: "y"`, "no_contiene: [y]"},
		{"igual_a", `igual_a: "x"`, "igual_a: [x]"},
		{"exit_code", "exit_code: 0", "exit_code: cero"},
		{"cerca_de", "cerca_de:", "cerca_de: 3\n        sobra:"},
		{"ancla", `ancla: "a"`, "ancla: [a]"},
		{"lineas", "lineas: 3", "lineas: tres"},
		{"contiene de cerca_de", `contiene: "b"`, "contiene: [b]"},
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
		{"aula", `aula: "Prueba"`, "aula: [uno]"},
		{"version", "version: 1", "version: uno"},
		{"comun", "comun:", "comun: 3\nsobra:"},
		{"hosts de comun", "  hosts:", "  hosts: 3\n  sobra:"},
		{"host", `host1: { ip: "10.0.0.1", puerto: 22, usuario: "usuario", password_ref: "${AULA_PASSWORD}" }`, "host1: 3"},
		{"ip", `ip: "10.0.0.1"`, "ip: 10"},
		{"puerto", "puerto: 22", "puerto: veintidós"},
		{"usuario", `usuario: "usuario"`, "usuario: [usuario]"},
		{"password_ref", `password_ref: "${AULA_PASSWORD}"`, "password_ref: [x]"},
		{"timeouts", "  timeouts:", "  timeouts: 3\n  sobra:"},
		{"conexion", "conexion: 5s", "conexion: 5"},
		{"alumno", "alumno: 10m", "alumno: [10m]"},
		{"alumnos", "alumnos:", "alumnos: 3\nsobra:"},
		{"alumno suelto", "  - id: alumne01", "  - 3\n  - id: alumne01"},
		{"id", "  - id: alumne01", "  - id: [alumne01]"},
		{"nombre", `nombre: "Ana Ferrer"`, "nombre: [ana]"},
		{"moodle_id", `moodle_id: "1234"`, "moodle_id: [1234]"},
		{"excluido", "excluido: false", "excluido: quizá"},
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
