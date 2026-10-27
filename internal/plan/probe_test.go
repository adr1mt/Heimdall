package plan

import (
	"fmt"
	"heimdall/internal/probe"
	"strings"
	"testing"
)

func probeExam() string {
	return fmt.Sprintf(`examen: "RA1"
version: 1
hosts: [host1]
por_defecto: {sudo: true}
grupos:
- grupo: Xarxa
  comprobaciones:
  - id: c1
    descripcion: "Xarxa · 01"
    en: host1
    comprobador: [ra1-dhcp, "%s", net-externa-ip, "${alumno.if_ext}", lan0, "${host1.ip}"]
    igual_a: OK
`, probe.Revision())
}

func TestProbeResolutionAndVersionGate(t *testing.T) {
	inv := validInventory
	// Use an existing field to avoid depending on fixture display names.
	exam := strings.ReplaceAll(probeExam(), "${alumno.if_ext}", "${alumno.id}")
	p, err := Load(project(t, exam, inv))
	if err != nil {
		t.Fatal(err)
	}
	c := p.Students[0].Checks[0]
	if !c.Probe || !c.Sudo || c.Cmd[0] != "heimdall:comprobador" || c.Cmd[4] != p.Students[0].ID {
		t.Fatalf("incorrect resolved probe: %+v", c)
	}
	if c.Cmd[6] != c.Target.IP {
		t.Fatal("host IP not substituted")
	}
	for _, change := range []struct{ from, to string }{
		{probe.Revision(), "wrong-revision"},
		{"net-externa-ip", "unknown-criterion"},
		{"igual_a: OK", "igual_a: FAIL"},
		{"    igual_a: OK", "    cmd: [hostname]\n    igual_a: OK"},
		{"${alumno.id}", "${AULA_PASSWORD}"},
	} {
		_, err := Load(project(t, strings.ReplaceAll(exam, change.from, change.to), inv))
		if err == nil {
			t.Fatalf("accepted invalid probe: %s", change.to)
		}
	}
	// The interpreter implementation never inflates PLAN metadata per student.
	if len(strings.Join(c.Cmd, " ")) > 300 {
		t.Fatal("source leaked into PLAN")
	}
}
