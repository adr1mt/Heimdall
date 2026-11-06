package plan

import (
	"fmt"
	"heimdall/internal/model"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// project writes a two-file project in a temporary directory. The YAML starts
// on line 1 of the file, so the line numbers the tests assert are the ones the
// teacher would read.
func project(t *testing.T, exam, inventory string) string {
	t.Helper()
	dir := t.TempDir()
	write := func(name, body string) {
		t.Helper()
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, []byte(strings.TrimPrefix(body, "\n")), 0o600); err != nil {
			t.Fatalf("escribiendo %s: %v", path, err)
		}
	}
	write(ExamFile, exam)
	write(InventoryFile, inventory)
	return dir
}

const validExam = `
exam: "Prueba"
version: 1
hosts: [host1]
defaults: { weight: 1, timeout: 20s }
groups:
  - group: "Base"
    checks:
      - id: p1
        description: "Se identifica"
        on: host1
        cmd: ["hostname"]
        contains: "alu"
      - id: p2
        description: "La cuenta existe"
        on: host1
        weight: 2
        cmd: ["id", "-un"]
        equals: "${student.user}"
`

const validInventory = `
classroom: "Prueba"
version: 1
common:
  hosts:
    host1:
      port: 22
      user: "alumno"
      password_ref: "${AULA_PASSWORD}"
students:
  - id: alumne01
    name: "Alumna Uno"
    hosts:
      host1: { ip: "10.0.0.1" }
    user: "ana"
  - id: alumne02
    name: "Alumne Dos"
    hosts:
      host1: { ip: "10.0.0.2" }
    user: "marc"
`

func TestResolveValidProject(t *testing.T) {
	p, err := Load(project(t, validExam, validInventory))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if p.Summary.CheckCount != 2 || p.Summary.TotalWeight != 3 {
		t.Errorf("check_count=%d total_weight=%v, se esperaba 2 y 3",
			p.Summary.CheckCount, p.Summary.TotalWeight)
	}
	if got := strings.Join(p.Summary.CheckIDs, ","); got != "p1,p2" {
		t.Errorf("check_ids = %q", got)
	}
	if len(p.Hash) != 64 || p.Exam.SHA256 == "" || p.Inventory.SHA256 == "" {
		t.Errorf("faltan hashes: plan=%q examen=%q aula=%q", p.Hash, p.Exam.SHA256, p.Inventory.SHA256)
	}
}

// The denominator is the same for everybody, whatever their data. This is the
// defect c14-check closed by construction (ADR-0004).
func TestPlanIsIdenticalForEveryStudent(t *testing.T) {
	p, err := Load(project(t, validExam, validInventory))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(p.Students) != 2 {
		t.Fatalf("alumnos = %d, se esperaban 2", len(p.Students))
	}
	first, second := p.Students[0], p.Students[1]
	if len(first.Checks) != len(second.Checks) {
		t.Fatalf("los alumnos tienen %d y %d comprobaciones", len(first.Checks), len(second.Checks))
	}
	for i := range first.Checks {
		a, b := first.Checks[i], second.Checks[i]
		if a.ID != b.ID || a.Weight != b.Weight || a.Group != b.Group {
			t.Errorf("comprobación %d difiere entre students: %+v vs %+v", i, a, b)
		}
	}
	// What may differ is the expected value, and it did.
	if *first.Checks[1].Equals == *second.Checks[1].Equals {
		t.Error("los dos alumnos esperan el mismo user: la sustitución no se aplicó")
	}
	if *first.Checks[1].Equals != "ana" || *second.Checks[1].Equals != "marc" {
		t.Errorf("valores esperados = %q y %q", *first.Checks[1].Equals, *second.Checks[1].Equals)
	}
}

// An excluded student takes nothing away from the others: same count, same
// weight, and no checks of their own.
func TestExcludedStudentDoesNotMoveTheDenominator(t *testing.T) {
	withExcluded := validInventory + `  - id: alumne03
    name: "Alumne Tres"
    excluded: true
    hosts:
      host1: { ip: "10.0.0.3" }
    user: "laia"
`
	base, err := Load(project(t, validExam, validInventory))
	if err != nil {
		t.Fatalf("Load base: %v", err)
	}
	got, err := Load(project(t, validExam, withExcluded))
	if err != nil {
		t.Fatalf("Load con excluded: %v", err)
	}
	if got.Summary.TotalWeight != base.Summary.TotalWeight || got.Summary.CheckCount != base.Summary.CheckCount {
		t.Errorf("el alumno excluido movió el plan: %+v vs %+v", got.Summary, base.Summary)
	}
	excluded := got.Students[2]
	if !excluded.Excluded || len(excluded.Checks) != 0 {
		t.Errorf("el alumno excluido tiene %d comprobaciones", len(excluded.Checks))
	}
}

// Rule 5 of §2: a substituted value travels as one argument, whatever it
// contains. This is where the injection vector dies.
func TestSubstitutedValueIsOneArgumentAndIsNeverReinterpreted(t *testing.T) {
	exam := `
exam: "Prueba"
version: 1
hosts: [host1]
groups:
  - group: "Base"
    checks:
      - id: p1
        description: "Argumento hostil"
        on: host1
        cmd: ["getent", "passwd", "${student.user}"]
        contains: "x"
`
	inventory := `
classroom: "Prueba"
version: 1
common:
  hosts:
    host1: { port: 22, user: "alumno" }
students:
  - id: alumne01
    name: "Alumna Uno"
    hosts:
      host1: { ip: "10.0.0.1" }
    user: "ana; rm -rf / 'x' \"y\""
`
	p, err := Load(project(t, exam, inventory))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	cmd := p.Students[0].Checks[0].Cmd
	want := []string{"getent", "passwd", `ana; rm -rf / 'x' "y"`}
	if len(cmd) != len(want) {
		t.Fatalf("cmd = %q, se esperaban %d argumentos", cmd, len(want))
	}
	for i := range want {
		if cmd[i] != want[i] {
			t.Errorf("argumento %d = %q, se esperaba %q", i, cmd[i], want[i])
		}
	}
}

// Substitution happens inside an element, not only as the whole of it.
func TestSubstitutionInsideAnArgument(t *testing.T) {
	exam := strings.Replace(validExam,
		`        equals: "${student.user}"`,
		`        equals: "${student.user}:x:"`, 1)
	p, err := Load(project(t, exam, validInventory))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got := *p.Students[0].Checks[1].Equals; got != "ana:x:" {
		t.Errorf("valor esperado = %q, se esperaba %q", got, "ana:x:")
	}
}

// The nine validations of docs/design/02-FORMATO.md §5, plus the ones that
// protect the substitution. Each one fails for its own reason, with the file
// and the line the teacher has to open.
func TestPlanValidations(t *testing.T) {
	cases := []struct {
		name      string
		exam      string
		inventory string
		want      string // substring of the message
		where     string // file:line
	}{
		{
			name: "2 · id repetido",
			exam: strings.Replace(validExam, "      - id: p2", "      - id: p1", 1),
			want: `id "p1" repetido`, where: "examen.yaml:13",
		},
		{
			name: "2 · id ausente",
			exam: strings.Replace(validExam, "      - id: p2\n        description:", "      - description:", 1),
			want: "no tiene id", where: "examen.yaml:13",
		},
		{
			name: "3 · host no declarado",
			exam: strings.Replace(validExam, "        on: host1\n        weight: 2", "        on: host2\n        weight: 2", 1),
			want: `usa el host "host2"`, where: "examen.yaml:13",
		},
		{
			name:      "4 · host sin datos para un alumno",
			inventory: strings.Replace(validInventory, "      host1: { ip: \"10.0.0.2\" }\n", "      host1: { user: \"marc\" }\n", 1),
			want:      `no tiene la ip del host "host1"`, where: "aula.yaml:15",
		},
		{
			name:      "5 · campo que falta en un solo alumno",
			inventory: strings.Replace(validInventory, "    user: \"marc\"\n", "", 1),
			want:      `el alumno "alumne02" no tiene el campo "user"`, where: "examen.yaml:13",
		},
		{
			name: "6 · comprobación sin aserción",
			exam: strings.Replace(validExam, "        equals: \"${student.user}\"\n", "", 1),
			want: "no comprueba nada", where: "examen.yaml:13",
		},
		{
			name: "6 · dos aserciones",
			exam: strings.Replace(validExam, "        equals: \"${student.user}\"",
				"        equals: \"x\"\n        contains: \"y\"", 1),
			want: "tiene 2 aserciones", where: "examen.yaml:13",
		},
		{
			name: "value: comparando el código de salida",
			exam: strings.Replace(validExam,
				"        on: host1\n        cmd: [\"hostname\"]\n        contains: \"alu\"",
				"        value: \"${student.user}\"\n        exit_code: 0", 1),
			want: "no ejecuta ningún comando", where: "examen.yaml:8",
		},
		{
			name: "cerca_de sin ancla",
			exam: strings.Replace(validExam, "        contains: \"alu\"",
				"        near: { lines: 5, contains: \"alu\" }", 1),
			want: "no tiene ancla", where: "examen.yaml:8",
		},
		{
			name: "cerca_de sin nada que buscar",
			exam: strings.Replace(validExam, "        contains: \"alu\"",
				"        near: { anchor: \"subnet\", lines: 5 }", 1),
			want: "no dice qué debe contener", where: "examen.yaml:8",
		},
		{
			name: "cerca_de con una ventana negativa",
			exam: strings.Replace(validExam, "        contains: \"alu\"",
				"        near: { anchor: \"subnet\", lines: -1, contains: \"alu\" }", 1),
			want: "no puede ser negativo", where: "examen.yaml:8",
		},
		{
			name: "7 · peso negativo",
			exam: strings.Replace(validExam, "        weight: 2", "        weight: -1", 1),
			want: "peso negativo", where: "examen.yaml:13",
		},
		{
			name:      "8 · contraseña literal en el alumno",
			inventory: strings.Replace(validInventory, "      host1: { ip: \"10.0.0.1\" }", "      host1: { ip: \"10.0.0.1\", password: \"secreta\" }", 1),
			want:      "contraseña escrita en el fichero", where: "aula.yaml:10",
		},
		{
			name: "9 · aula sin alumnos evaluables",
			inventory: strings.ReplaceAll(
				strings.Replace(validInventory, "  - id: alumne01", "  - id: alumne01\n    excluded: true", 1),
				"  - id: alumne02", "  - id: alumne02\n    excluded: true"),
			want: "ningún alumno evaluable", where: "aula.yaml:",
		},
		{
			name:      "secreto en un campo libre del alumno",
			inventory: strings.Replace(validInventory, `    user: "ana"`, `    user: "${AULA_PASSWORD}"`, 1),
			want:      "referencia a un secreto", where: "aula.yaml:10",
		},
		{
			name:      "secreto en un campo de host del alumno",
			inventory: strings.Replace(validInventory, `      host1: { ip: "10.0.0.1" }`, `      host1: { ip: "10.0.0.1", user: "${AULA_PASSWORD}" }`, 1),
			want:      "referencia a un secreto fuera de password_ref", where: "aula.yaml:10",
		},
		{
			name: "secreto en el examen",
			exam: strings.Replace(validExam, "        contains: \"alu\"", "        contains: \"${AULA_PASSWORD}\"", 1),
			want: "solo puede aparecer", where: "examen.yaml:8",
		},
		{
			name: "host inexistente en una sustitución",
			exam: strings.Replace(validExam, "        contains: \"alu\"", "        contains: \"${host9.ip}\"", 1),
			want: `el host "host9" no está declarado`, where: "examen.yaml:8",
		},
		{
			name: "campo de host que no existe",
			exam: strings.Replace(validExam, "        contains: \"alu\"", "        contains: \"${host1.mac}\"", 1),
			want: "solo se puede usar ip, port o user", where: "examen.yaml:8",
		},
		{
			name: "comprobación sin cmd ni valor",
			exam: strings.Replace(validExam, "        cmd: [\"hostname\"]\n", "", 1),
			want: "no tiene ni cmd: ni value:", where: "examen.yaml:8",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			exam, inventory := tc.exam, tc.inventory
			if exam == "" {
				exam = validExam
			}
			if inventory == "" {
				inventory = validInventory
			}
			if exam == validExam && inventory == validInventory {
				t.Fatal("el caso no modifica ningún fichero")
			}

			_, err := Load(project(t, exam, inventory))
			if err == nil {
				t.Fatal("se aceptó un proyecto que debe rechazarse")
			}
			got := err.Error()
			if !strings.Contains(got, tc.want) {
				t.Errorf("error %q, se esperaba que contuviera %q", got, tc.want)
			}
			if !strings.Contains(got, tc.where) {
				t.Errorf("error %q, se esperaba fichero y línea %q", got, tc.where)
			}
		})
	}
}

// Weight 0 is legal: the check runs, it is reported and it does not grade.
func TestZeroWeightIsLegal(t *testing.T) {
	exam := strings.Replace(validExam, "        weight: 2", "        weight: 0", 1)
	p, err := Load(project(t, exam, validInventory))
	if err != nil {
		t.Fatalf("un peso 0 debe aceptarse: %v", err)
	}
	if p.Summary.TotalWeight != 1 || p.Summary.CheckCount != 2 {
		t.Errorf("summary = %+v, se esperaban 2 comprobaciones y peso 1", p.Summary)
	}
}

// The plan hash answers "were these two students asked the same thing?".
func TestPlanHashChangesWithTheQuestionsAndNotWithTheRun(t *testing.T) {
	dir := project(t, validExam, validInventory)
	first, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	again, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if first.Hash != again.Hash {
		t.Errorf("dos lecturas del mismo proyecto dan hashes distintos: %s y %s", first.Hash, again.Hash)
	}

	changed, err := Load(project(t, strings.Replace(validExam, `contains: "alu"`, `contains: "otro"`, 1), validInventory))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if changed.Hash == first.Hash {
		t.Error("cambiar lo que se comprueba no cambió el hash del plan")
	}
}

func TestEnglishPlanHashStable(t *testing.T) {
	p, err := Load(project(t, validExam, validInventory))
	if err != nil {
		t.Fatal(err)
	}
	if p.Hash != "721d69c3eacafc29bc440ea776c65476c6551b740274a95932f6b5349ad3703f" {
		t.Fatalf("English project hash changed: %s", p.Hash)
	}
	expected := "a<&\n"
	other := &Plan{Exam: model.SourceRef{SHA256: "exam"}, Inventory: model.SourceRef{SHA256: "inventory"}, Summary: model.PlanSummary{TotalWeight: 1}, Students: []StudentPlan{
		{ID: "z", Excluded: true},
		{ID: "a", Checks: []ResolvedCheck{{ID: "c", Group: "G", Weight: 1, Timeout: time.Second, Value: "a<&\n", Contains: &expected}}},
	}}
	if got := hashPlan(other); got != "1fd0a0929f89cccccf0c09f6d5be3113e812e0a9048e39591c1df45671a766a5" {
		t.Fatalf("sorted, excluded, escaped plan hash changed: %s", got)
	}
}

func BenchmarkHashPlanLarge(b *testing.B) {
	const students, checks = 100, 20
	value := strings.Repeat("x", 65536)
	p := &Plan{Exam: model.SourceRef{SHA256: "exam"}, Inventory: model.SourceRef{SHA256: "inventory"}, Summary: model.PlanSummary{TotalWeight: checks}}
	expected := "x"
	for i := 0; i < students; i++ {
		student := StudentPlan{ID: fmt.Sprintf("fake%d", i)}
		for j := 0; j < checks; j++ {
			student.Checks = append(student.Checks, ResolvedCheck{ID: fmt.Sprintf("c%d", j), Group: "G", Weight: 1, Timeout: time.Second, Value: value, Contains: &expected})
		}
		p.Students = append(p.Students, student)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if hashPlan(p) == "" {
			b.Fatal("empty hash")
		}
	}
}

// A project directory without the two files is a configuration error with a
// readable message, not a panic.
func TestMissingProjectFiles(t *testing.T) {
	if _, err := Load(t.TempDir()); err == nil {
		t.Fatal("un directorio vacío debe ser error")
	}
}

func TestNonfiniteWeightsRejected(t *testing.T) {
	for _, weight := range []string{".nan", ".inf", "-.inf"} {
		for _, exam := range []string{strings.Replace(validExam, "weight: 2", "weight: "+weight, 1), strings.Replace(validExam, "weight: 1", "weight: "+weight, 1)} {
			_, err := Load(project(t, exam, validInventory))
			if err == nil || !strings.Contains(err.Error(), "finito") {
				t.Fatalf("%s: %v", weight, err)
			}
		}
	}
	exam := strings.ReplaceAll(strings.Replace(validExam, "weight: 1", "weight: 1e308", 1), "weight: 2", "weight: 1e308")
	if _, err := Load(project(t, exam, validInventory)); err == nil {
		t.Fatal("nonfinite sum accepted")
	}
}

func TestResultBudgetRejectsUnsupportedConfiguration(t *testing.T) {
	p := &Plan{Summary: model.PlanSummary{CheckCount: model.MaxResultCells + 1}, Students: []StudentPlan{{ID: "fake"}}}
	if err := validateResultBudget(p); err == nil {
		t.Fatal("oversized matrix accepted")
	}
	p.Summary.CheckCount = 1
	p.Students[0].Name = strings.Repeat("x", model.MaxResultMetadataBytes)
	if err := validateResultBudget(p); err == nil {
		t.Fatal("oversized metadata accepted")
	}
	p.Students[0].Name = "Ficticio"
	p.Students[0].Checks = []ResolvedCheck{{Value: strings.Repeat("x", 65536)}}
	if err := validateResultBudget(p); err != nil {
		t.Fatal("inventory evidence counted as metadata", err)
	}
}

func TestZeroTotalWeightRejectedButDiagnosticChecksAllowed(t *testing.T) {
	exam := `exam: Diagnóstico ficticio
version: 1
hosts: []
defaults: {weight: 0}
groups:
  - group: G
    checks:
      - id: zero
        value: yes
        contains: yes
`
	inventory := "classroom: Ficticia\nversion: 1\nstudents:\n  - id: fake\n    name: Ficticio\n"
	if _, err := Load(project(t, exam, inventory)); err == nil || !strings.Contains(err.Error(), "peso positivo") {
		t.Fatalf("zero total: %v", err)
	}
	mixed := exam + "      - id: positive\n        weight: 1\n        value: yes\n        contains: yes\n"
	p, err := Load(project(t, mixed, inventory))
	if err != nil {
		t.Fatal(err)
	}
	if p.Summary.TotalWeight != 1 || p.Students[0].Checks[0].Weight != 0 {
		t.Fatal("diagnostic weight changed")
	}
}

func TestResolvedInventoryValuesRespectByteLimit(t *testing.T) {
	for _, utf := range []bool{false, true} {
		for _, size := range []int{65535, 65536, 65537} {
			value := strings.Repeat("x", size)
			if utf {
				value = strings.Repeat("é", size/2) + strings.Repeat("x", size%2)
			}
			exam := `exam: Ficticio
version: 1
hosts: []
groups:
  - group: G
    checks:
      - id: c
        value: "${student.answer}"
        contains: x
`
			inventory := fmt.Sprintf("classroom: Ficticia\nversion: 1\nstudents:\n  - id: fake\n    name: Ficticio\n    answer: %q\n", value)
			p, err := Load(project(t, exam, inventory))
			if size > model.MaxStreamBytes {
				if err == nil || !strings.Contains(err.Error(), "65536 bytes") {
					t.Fatalf("%d bytes accepted: %v", size, err)
				}
			} else if err != nil || len(p.Students[0].Checks[0].Value) != size {
				t.Fatalf("valid %d bytes refused: %v", size, err)
			}
		}
	}
}
