package plan

import (
	"fmt"
	"heimdall/internal/probe"
	"strings"
	"testing"
)

func probeExam() string {
	return fmt.Sprintf(`exam: "RA1"
version: 1
hosts: [host1]
defaults: {sudo: true}
groups:
- group: Xarxa
  checks:
  - id: c1
    description: "Xarxa · 01"
    on: host1
    checker: [ra1-dhcp, "%s", net-externa-ip, "${student.if_ext}", lan0, "${host1.ip}"]
    equals: OK
`, probe.Revision())
}

func TestProbeResolutionAndVersionGate(t *testing.T) {
	inv := validInventory
	// Use an existing field to avoid depending on fixture display names.
	exam := strings.ReplaceAll(probeExam(), "${student.if_ext}", "${student.id}")
	p, err := Load(project(t, exam, inv))
	if err != nil {
		t.Fatal(err)
	}
	c := p.Students[0].Checks[0]
	if !c.Probe || !c.Sudo || c.Cmd[0] != "heimdall:checker" || c.Cmd[4] != p.Students[0].ID {
		t.Fatalf("incorrect resolved probe: %+v", c)
	}
	if c.Cmd[6] != c.Target.IP {
		t.Fatal("host IP not substituted")
	}
	grouped := strings.ReplaceAll(exam, "net-externa-ip", "kea-reserves")
	groupedPlan, err := Load(project(t, grouped, inv))
	if err != nil || groupedPlan.Students[0].Checks[0].Cmd[3] != "kea-reserves" {
		t.Fatalf("grouped reservation criterion not resolved: %v", err)
	}
	for _, change := range []struct{ from, to string }{
		{probe.Revision(), "wrong-revision"},
		{"net-externa-ip", "unknown-criterion"},
		{"equals: OK", "equals: FAIL"},
		{"    equals: OK", "    cmd: [hostname]\n    equals: OK"},
		{"${student.id}", "${AULA_PASSWORD}"},
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
