//go:build examtest

package ra1_test

import (
	"heimdall/internal/plan"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestFixedDNSVariantsUseSemanticKeaOptions(t *testing.T) {
	python, err := exec.LookPath("python3")
	if err != nil {
		t.Fatal("Python 3 is required for the RA1 checker regression")
	}
	// Load the exact remote program as a module. Only external configuration
	// acquisition is replaced; option lookup, inheritance and decoding are real.
	script := `import sys
ns = {'__name__': 'ra1_test'}
exec(compile(sys.stdin.read(), 'ra1', 'exec'), ns)
expected, other = sys.argv[1:]
subnet = {'subnet': '10.0.0.0/8'}
root = {'option-data': [{'name': 'domain-name-servers', 'data': expected}]}
ns['kea'] = lambda: (root, {}, subnet, [(subnet, {})])
check = lambda: ns['kea_check']('kea-dns', 'lan0')
assert check(), 'inherited DNS rejected'
subnet['option-data'] = [{'code': 6, 'data': other}]
assert not check(), 'wrong subnet override accepted'
subnet['option-data'] = [{'code': 6, 'csv-format': False, 'data': bytes(map(int, expected.split('.'))).hex()}]
assert check(), 'binary option rejected'
subnet['option-data'] = [{'code': 6, 'data': expected + ',' + other}]
assert not check(), 'additional DNS accepted'
`
	for _, tc := range []struct{ folder, expected, other string }{
		{"ra1-dhcp-kea", "9.9.9.9", "8.8.8.8"},
		{"ra1-v2", "8.8.8.8", "9.9.9.9"},
	} {
		t.Run(tc.expected, func(t *testing.T) {
			program, err := os.ReadFile(filepath.Join("../../../exams", tc.folder, "checker.py"))
			if err != nil {
				t.Fatal(err)
			}
			cmd := exec.Command(python, "-I", "-c", script, tc.expected, tc.other)
			cmd.Stdin = strings.NewReader(string(program))
			if output, err := cmd.CombinedOutput(); err != nil {
				t.Fatalf("DNS regression: %v\n%s", err, output)
			}
		})
	}
}

func TestRA1V2ExamRubric(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	if out, err := exec.Command("sh", "../../../exams/install-ra1-checkers.sh").CombinedOutput(); err != nil {
		t.Fatalf("%v: %s", err, out)
	}

	exam, err := os.ReadFile("../../../exams/ra1-v2/examen.yaml")
	if err != nil {
		t.Fatal(err)
	}
	if err := plan.CheckExam("../../../exams/ra1-v2/examen.yaml"); err != nil {
		t.Fatal(err)
	}
	inv, err := os.ReadFile("aula.yaml")
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	for name, data := range map[string][]byte{"examen.yaml": exam, "aula.yaml": inv} {
		if err := os.WriteFile(filepath.Join(dir, name), data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	p, err := plan.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if p.ExamName != "RA1 v2" || p.Summary.CheckCount != 12 || p.Summary.TotalWeight != 19 {
		t.Fatalf("unexpected rubric: %s, %+v", p.ExamName, p.Summary)
	}
	kea, forwarding := 0, 0
	for _, check := range p.Students[0].Checks {
		if !check.Probe || check.Cmd[2] != "cc653e10b6087ad31ce72344a361f53599376188cfef6aea560d67f2fb8f9811" {
			t.Fatalf("wrong checker revision: %s", check.ID)
		}
		if strings.HasPrefix(check.ID, "kea-") {
			kea++
			if check.Weight != 2 {
				t.Fatalf("Kea weight must be 2: %s", check.ID)
			}
		}
		if strings.HasPrefix(check.ID, "fwd-") {
			forwarding++
			if check.ID != "fwd-persistent" {
				t.Fatalf("only saved forwarding is requested: %s", check.ID)
			}
		}
		if strings.HasPrefix(check.ID, "nft-") || check.ID == "client-concessio" {
			t.Fatalf("unrequested criterion: %s", check.ID)
		}
	}
	if kea != 7 || forwarding != 1 {
		t.Fatalf("expected seven Kea and one forwarding checks, got %d/%d", kea, forwarding)
	}
}
