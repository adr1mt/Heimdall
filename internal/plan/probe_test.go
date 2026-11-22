package plan

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func probeExam(t *testing.T) (string, string) {
	t.Helper()
	root := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", root)
	source := []byte("print('OK')")
	revision := fmt.Sprintf("%x", sha256.Sum256(source))
	d := filepath.Join(root, "heimdall", "checkers", "example", revision)
	if err := os.MkdirAll(d, 0700); err != nil {
		t.Fatal(err)
	}
	for file, data := range map[string][]byte{"criteria.json": []byte(`{"arguments":3,"criteria":["first","second"]}`), "checker.py": source} {
		if err := os.WriteFile(filepath.Join(d, file), data, 0600); err != nil {
			t.Fatal(err)
		}
	}

	return fmt.Sprintf(`exam: "Example"
version: 1
hosts: [host1]
defaults: {sudo: true}
groups:
- group: Red
  checks:
  - id: c1
    description: "Red · 01"
    on: host1
    checker: [example, "%s", first, "${student.if_ext}", lan0, "${host1.ip}"]
    equals: OK
`, revision), revision
}

func TestProbeResolutionAndVersionGate(t *testing.T) {
	inv := validInventory
	// Use an existing field to avoid depending on fixture display names.
	fixture, revision := probeExam(t)
	exam := strings.ReplaceAll(fixture, "${student.if_ext}", "${student.id}")
	p, err := Load(project(t, exam, inv))
	if err != nil {
		t.Fatal(err)
	}
	c := p.Students[0].Checks[0]
	if c.Program != "print('OK')" || !c.Probe || !c.Sudo || c.Cmd[0] != "heimdall:checker" || c.Cmd[4] != p.Students[0].ID {
		t.Fatalf("incorrect resolved probe: %+v", c)
	}
	if c.Cmd[6] != c.Target.IP {
		t.Fatal("host IP not substituted")
	}
	grouped := strings.ReplaceAll(exam, "first", "second")
	groupedPlan, err := Load(project(t, grouped, inv))
	if err != nil || groupedPlan.Students[0].Checks[0].Cmd[3] != "second" {
		t.Fatalf("second criterion not resolved: %v", err)
	}
	for _, change := range []struct{ from, to string }{
		{revision, "wrong-revision"},
		{"first", "unknown-criterion"},
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

func TestChangedOrMissingCheckerStopsValidation(t *testing.T) {
	exam, revision := probeExam(t)
	exam = strings.ReplaceAll(exam, "${student.if_ext}", "${student.id}")
	dir := project(t, exam, validInventory)
	file := filepath.Join(os.Getenv("XDG_CONFIG_HOME"), "heimdall", "checkers", "example", revision, "checker.py")
	if err := os.WriteFile(file, []byte("changed"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(dir); err == nil || !strings.Contains(err.Error(), "no coincide") {
		t.Fatalf("changed program: %v", err)
	}
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	if _, err := Load(dir); err == nil {
		t.Fatal("accepted exam without its installed profile")
	}
}
