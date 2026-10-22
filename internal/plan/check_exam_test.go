package plan

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCheckExamWithoutStudentData(t *testing.T) {
	dir := project(t, strings.Replace(validExam, "timeout: 20s", "timeout: 20s, sudo: true", 1), "[invalid")
	if err := CheckExam(filepath.Join(dir, ExamFile)); err != nil {
		t.Fatal(err)
	}
	// Missing columns and host data still prevent a complete PLAN.
	for _, inventory := range []string{
		strings.Replace(validInventory, `    usuario: "marc"`, "", 1),
		strings.Replace(validInventory, `host1: { ip: "10.0.0.2" }`, `host1: { usuario: "marc" }`, 1),
	} {
		dir := project(t, validExam, inventory)
		if err := CheckExam(filepath.Join(dir, ExamFile)); err != nil {
			t.Fatal(err)
		}
		if _, err := Load(dir); err == nil {
			t.Fatal("accepted incomplete PLAN")
		}
	}
}

func TestCheckExamRejectsOwnErrors(t *testing.T) {
	for _, tc := range []struct{ name, yaml, want string }{
		{"syntax", "examen: [", "examen.yaml:"},
		{"unknown key", validExam + "extra: yes\n", "desconocida"},
		{"duplicate id", strings.Replace(validExam, "id: p2", "id: p1", 1), `id "p1" repetido`},
		{"host", strings.ReplaceAll(validExam, "en: host1", "en: host9"), `usa el host "host9"`},
		{"assertion", strings.Replace(validExam, `contiene: "alu"`, "", 1), "le falta la aserción"},
		{"weight", strings.Replace(validExam, "peso: 2", "peso: -1", 1), "peso negativo"},
		{"zero total", strings.ReplaceAll(strings.ReplaceAll(validExam, "peso: 1", "peso: 0"), "peso: 2", "peso: 0"), "peso positivo"},
		{"infinite total", strings.ReplaceAll(strings.ReplaceAll(validExam, "peso: 1", "peso: 1e308"), "peso: 2", "peso: 1e308"), "suma de pesos"},
		{"defaults", strings.Replace(validExam, "peso: 1", "peso: -1", 1), "por_defecto.peso"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, ExamFile)
			if err := os.WriteFile(path, []byte(tc.yaml), 0600); err != nil {
				t.Fatal(err)
			}
			err := CheckExam(path)
			if err == nil || !strings.Contains(err.Error(), tc.want) || !strings.Contains(err.Error(), "examen.yaml:") {
				t.Fatalf("error=%v, want %s with file and line", err, tc.want)
			}
		})
	}
}

func TestCheckExamReferencesAcrossAllInterpolatedFields(t *testing.T) {
	for _, field := range []string{
		`en: host1
        cmd: ["echo", "REF"]
        exit_code: 0`,
		`valor: "REF"
        igual_a: "ok"`,
		`valor: ok
        contiene: "REF"`,
		`valor: ok
        no_contiene: "REF"`,
		`valor: ok
        igual_a: "REF"`,
		`valor: ok
        cerca_de: {ancla: "REF", lineas: 0, contiene: ok}`,
		`valor: ok
        cerca_de: {ancla: ok, lineas: 0, contiene: "REF"}`,
	} {
		for _, ref := range []struct{ text, want string }{
			{"${alumno.campo_pendiente}", ""},
			{"${host1.ip}:${host1.puerto} ${host1.usuario}", ""},
			{"${AULA_PASSWORD}", "solo puede aparecer"},
			{"${alumno.campo", "falta la llave final"},
			{"${alumno.}", "inválida"},
			{"${host9.ip}", "no está declarado"},
			{"${host1.password}", "solo se puede usar"},
		} {
			t.Run(field+ref.text, func(t *testing.T) {
				yaml := "examen: P\nversion: 1\nhosts: [host1]\ngrupos:\n  - grupo: G\n    comprobaciones:\n      - id: c\n        " + strings.ReplaceAll(field, "REF", ref.text) + "\n"
				dir := t.TempDir()
				path := filepath.Join(dir, ExamFile)
				if err := os.WriteFile(path, []byte(yaml), 0600); err != nil {
					t.Fatal(err)
				}
				err := CheckExam(path)
				if ref.want == "" {
					if err != nil {
						t.Fatal(err)
					}
					return
				}
				if err == nil || !strings.Contains(err.Error(), ref.want) || !strings.Contains(err.Error(), "examen.yaml:7:") {
					t.Fatalf("error=%v, want %s at check line", err, ref.want)
				}
			})
		}
	}
}
