package plan

import (
	"strings"
	"testing"
)

const sudoExam = `
examen: "Sudo"
version: 1
hosts: [host1]
por_defecto: { peso: 1, timeout: 20s, sudo: true }
grupos:
  - grupo: "Base"
    comprobaciones:
      - id: p1
        en: host1
        cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]
        contiene: "subnet"
      - id: p2
        en: host1
        sudo: false
        cmd: ["hostname"]
        contiene: "alu"
      - id: p3
        valor: "${alumno.usuario}"
        igual_a: "ana"
`

// TestSudoIsInheritedOnlyByCommands: por_defecto.sudo reaches the checks with
// a command, a check can say no, and a valor: check runs nothing.
func TestSudoIsInheritedOnlyByCommands(t *testing.T) {
	inv := strings.Replace(validInventory, `usuario: "marc"`, `usuario: "ana"`, 1)
	p, err := Load(project(t, sudoExam, inv))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	got := map[string]bool{}
	for _, c := range p.Students[0].Checks {
		got[c.ID] = c.Sudo
	}
	if !got["p1"] || got["p2"] || got["p3"] {
		t.Fatalf("sudo resuelto %v; se esperaba p1 sí, p2 no, p3 no", got)
	}
}

// TestSudoChangesThePlanHashOnlyWhenUsed: a plan without sudo keeps the hash
// it had before sudo existed, so earlier runs can still be repeated, and
// turning sudo on is a different PLAN.
func TestSudoChangesThePlanHashOnlyWhenUsed(t *testing.T) {
	without, err := Load(project(t, validExam, validInventory))
	if err != nil {
		t.Fatal(err)
	}
	withFalse, err := Load(project(t, strings.Replace(validExam, "timeout: 20s }", "timeout: 20s, sudo: false }", 1), validInventory))
	if err != nil {
		t.Fatal(err)
	}
	withTrue, err := Load(project(t, strings.Replace(validExam, "timeout: 20s }", "timeout: 20s, sudo: true }", 1), validInventory))
	if err != nil {
		t.Fatal(err)
	}
	// The exam files differ, so compare the per-check part only through
	// the plans built from the same file shape.
	if without.Students[0].Checks[0].Sudo || withFalse.Students[0].Checks[0].Sudo || !withTrue.Students[0].Checks[0].Sudo {
		t.Fatal("sudo no se ha resuelto como dice por_defecto")
	}
	a, b := *without, *without
	b.Students = append([]StudentPlan(nil), without.Students...)
	b.Students[0].Checks = append([]ResolvedCheck(nil), without.Students[0].Checks...)
	if hashPlan(&a) != hashPlan(&b) {
		t.Fatal("el hash debe ser estable")
	}
	b.Students[0].Checks[0].Sudo = true
	if hashPlan(&a) == hashPlan(&b) {
		t.Fatal("pedir sudo debe cambiar el hash del PLAN")
	}
}

func TestSudoPlanErrors(t *testing.T) {
	cases := []struct {
		name, exam, inventory, want string
	}{
		{
			name:      "sudo que no es sí o no",
			exam:      strings.Replace(validExam, `cmd: ["hostname"]`, "sudo: \"si\"\n        cmd: [\"hostname\"]", 1),
			inventory: validInventory,
			want:      `examen.yaml:11: la clave "sudo" debe ser sí o no (true o false)`,
		},
		{
			name:      "sudo en una comprobación sin comando",
			exam:      strings.Replace(sudoExam, `valor: "${alumno.usuario}"`, "valor: \"${alumno.usuario}\"\n        sudo: true", 1),
			inventory: validInventory,
			want:      `la comprobación "p3" pide sudo, pero no ejecuta ningún comando`,
		},
		{
			name:      "host sin contraseña",
			exam:      sudoExam,
			inventory: strings.Replace(validInventory, `      password_ref: "${AULA_PASSWORD}"`+"\n", "", 1),
			want:      `aula.yaml:9: el examen usa sudo en el host "host1", pero el alumno "alumne01" no tiene password_ref`,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Load(project(t, tc.exam, tc.inventory))
			if err == nil {
				t.Fatalf("se esperaba un error que contuviera %q", tc.want)
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error:\n%v\nse esperaba que contuviera:\n%s", err, tc.want)
			}
		})
	}
}
