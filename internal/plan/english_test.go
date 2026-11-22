package plan

import (
	"strings"
	"testing"
)

func TestEnglishOnlyExamKeys(t *testing.T) {
	const source = `exam: Prueba
version: 1
hosts: [host1]
defaults: {weight: 1}
groups:
  - group: Red
    checks:
      - id: c
        description: Texto
        on: host1
        cmd: [hostname]
        near: {anchor: host, lines: 1, contains: host}
`
	if err := CheckExam(write(t, "examen.yaml", source)); err != nil {
		t.Fatal(err)
	}
	for _, pair := range [][2]string{{"exam", "examen"}, {"defaults", "por_defecto"}, {"weight", "peso"}, {"groups", "grupos"}, {"group", "grupo"}, {"checks", "comprobaciones"}, {"description", "descripcion"}, {"on", "en"}, {"near", "cerca_de"}, {"anchor", "ancla"}, {"lines", "lineas"}, {"contains", "contiene"}} {
		t.Run(pair[1], func(t *testing.T) {
			changed := strings.Replace(source, pair[0]+":", pair[1]+":", 1)
			err := CheckExam(write(t, "examen.yaml", changed))
			if err == nil || !strings.Contains(err.Error(), "clave desconocida") || !strings.Contains(err.Error(), "examen.yaml:") {
				t.Fatalf("Spanish key accepted or missing location: %v", err)
			}
		})
	}
	for _, assertion := range []string{"igual_a: host", "no_contiene: nope", "valor: host"} {
		if err := CheckExam(write(t, "examen.yaml", source+"        "+assertion+"\n")); err == nil {
			t.Fatalf("mixed syntax accepted: %s", assertion)
		}
	}
}

func TestEnglishOnlyInventoryKeys(t *testing.T) {
	const source = `classroom: Aula
version: 1
common:
  hosts:
    host1: {ip: "192.0.2.1", port: 22, user: alumno}
  timeouts: {connect: 1s, student: 1m}
students:
  - id: a
    name: Alumna
    excluded: false
    respuesta: sí
`
	for _, pair := range [][2]string{{"classroom", "aula"}, {"common", "comun"}, {"port", "puerto"}, {"user", "usuario"}, {"connect", "conexion"}, {"student", "alumno"}, {"students", "alumnos"}, {"name", "nombre"}, {"excluded", "excluido"}} {
		t.Run(pair[1], func(t *testing.T) {
			_, err := LoadInventory(write(t, "aula.yaml", strings.Replace(source, pair[0]+":", pair[1]+":", 1)))
			if err == nil || !strings.Contains(err.Error(), "clave desconocida") || !strings.Contains(err.Error(), "aula.yaml:") {
				t.Fatalf("Spanish inventory key accepted: %v", err)
			}
		})
	}
	inv, err := LoadInventory(write(t, "aula.yaml", source))
	if err != nil || inv.Students[0].Fields["respuesta"] != "sí" || inv.Students[0].Hosts["host1"].User != "alumno" {
		t.Fatalf("teacher data or SSH login changed: %+v, %v", inv, err)
	}
}

func TestEnglishReferencesOnly(t *testing.T) {
	sc := scope{studentID: "a", fields: map[string]string{"respuesta": "sí"}, hosts: map[string]Host{"host1": {IP: "192.0.2.1", Port: 22, User: "alumno"}}}
	got, err := substitute("${student.respuesta} ${host1.ip} ${host1.port} ${host1.user}", sc)
	if err != nil || got != "sí 192.0.2.1 22 alumno" {
		t.Fatalf("English references: %q %v", got, err)
	}
	for _, ref := range []string{"${alumno.respuesta}", "${host1.puerto}", "${host1.usuario}"} {
		if _, err := substitute(ref, sc); err == nil {
			t.Fatalf("Spanish reference accepted: %s", ref)
		}
	}
}
