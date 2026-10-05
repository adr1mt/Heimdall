package plan

import (
	"encoding/json"
	"strings"
	"testing"
)

func fileExam(path string) string {
	return strings.ReplaceAll(validExam, `cmd: ["hostname"]`, "fichero: "+path)
}

func TestFileSourceValidationAndSubstitution(t *testing.T) {
	for _, tc := range []struct{ name, source, extra, want string }{
		{"empty", `""`, "", "ruta absoluta"},
		{"null", `null`, "", "ruta absoluta"},
		{"relative", `"etc/kea.conf"`, "", "ruta absoluta"},
		{"nul", `"/etc/a\0b"`, "", "ruta absoluta"},
		{"secret", `"/${AULA_PASSWORD}"`, "", "secreto"},
		{"unknown variable", `"/${alumno.no_existe}"`, "", "no_existe"},
		{"command", `"/etc/a"`, "        cmd: []\n", "solo una fuente"},
		{"value", `"/etc/a"`, "        valor: \"\"\n", "solo una fuente"},
		{"exit code", `"/etc/a"`, "        exit_code: 0\n", "exit_code requiere cmd"},
		{"no host", `"/etc/a"`, "", "host"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			exam := fileExam(tc.source)
			exam = strings.Replace(exam, `        contiene: "alu"`, tc.extra+`        contiene: "alu"`, 1)
			if tc.name == "no host" {
				exam = strings.Replace(exam, "        en: host1\n", "", 1)
			}
			_, err := Load(project(t, exam, validInventory))
			if err == nil || !strings.Contains(err.Error(), tc.want) || !strings.Contains(err.Error(), "examen.yaml:") {
				t.Fatalf("error: %v, want %s", err, tc.want)
			}
		})
	}
	p, err := Load(project(t, fileExam(`"/etc/${alumno.usuario}; con 'espacios'.conf"`), validInventory))
	if err != nil {
		t.Fatal(err)
	}
	for i, want := range []string{"/etc/ana; con 'espacios'.conf", "/etc/marc; con 'espacios'.conf"} {
		c := p.Students[i].Checks[0]
		if c.File != want || len(c.Cmd) != 3 || c.Cmd[0] != "cat" || c.Cmd[1] != "--" || c.Cmd[2] != want {
			t.Fatalf("literal source: %+v", c)
		}
	}
}

func TestFileTimeoutsValidatedAfterSubstitution(t *testing.T) {
	exam := strings.ReplaceAll(fileExam(`"/etc/${alumno.usuario}"`), `cmd: ["id", "-un"]`, `fichero: "/etc/ana"`)
	exam = strings.Replace(exam, "        peso: 2", "        peso: 2\n        timeout: 1s", 1)
	_, err := Load(project(t, exam, validInventory))
	if err == nil || !strings.Contains(err.Error(), "mismo tiempo límite") || !strings.Contains(err.Error(), "alumne01") || !strings.Contains(err.Error(), "examen.yaml:") {
		t.Fatal(err)
	}
	// Different paths must allow different timeouts.
	exam = strings.Replace(exam, `fichero: "/etc/ana"`, `fichero: "/etc/otro"`, 1)
	if _, err := Load(project(t, exam, validInventory)); err != nil {
		t.Fatal(err)
	}
}

func TestFileSourceChangesHashEvenWithIdenticalCommand(t *testing.T) {
	p, err := Load(project(t, fileExam(`"/etc/a"`), validInventory))
	if err != nil {
		t.Fatal(err)
	}
	before := hashPlan(p)
	for i := range p.Students {
		p.Students[i].Checks[0].File = ""
	}
	if before == hashPlan(p) {
		t.Fatal("file semantics omitted from hash")
	}
}

func TestLegacyFileFieldDoesNotConsumeMetadataBudget(t *testing.T) {
	p, err := Load(project(t, validExam, validInventory))
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(p.Students[0].Checks[0])
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), `"File":`) {
		t.Fatal("absent file source consumed legacy metadata budget")
	}
	p.Students[0].Checks[0].File = "/etc/a"
	data, err = json.Marshal(p.Students[0].Checks[0])
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"File":"/etc/a"`) {
		t.Fatal("explicit file omitted from metadata budget")
	}
}
