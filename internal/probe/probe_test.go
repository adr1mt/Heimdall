package probe

import (
	"os/exec"
	"strings"
	"testing"
)

func TestFixedRevisionsSelectTheirOwnProgram(t *testing.T) {
	if Revision() != "e832a93079d00ac294308ad40c3fc7cca140fbdc2d2ec6ef345a82f30fb91862" {
		t.Fatal("original exam revision changed")
	}
	if strings.Count(source, originalDNS) != 1 || sourceV2 == source ||
		strings.Replace(sourceV2, v2DNS, originalDNS, 1) != source {
		t.Fatal("v2 must change exactly the fixed DHCP DNS expectation")
	}
	for _, revision := range []string{Revision(), RevisionV2()} {
		args := []string{"ra1-dhcp", revision, "kea-dns", "wan0", "lan0", "192.168.236.60"}
		if err := Validate(args); err != nil {
			t.Fatal(err)
		}
		cmd := Command(args)
		program, _ := sourceForRevision(revision)
		if len(cmd) != 8 || cmd[0] != "python3" || cmd[1] != "-I" || cmd[3] != program || cmd[4] != "kea-dns" {
			t.Fatalf("wrong command for %s", revision)
		}
	}
	args := []string{"ra1-dhcp", "unknown", "kea-dns", "wan0", "lan0", "192.168.236.60"}
	if Validate(args) == nil || Command(args) != nil {
		t.Fatal("unknown revision must never select a program")
	}
}

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
	for _, tc := range []struct{ revision, expected, other string }{
		{Revision(), "9.9.9.9", "8.8.8.8"},
		{RevisionV2(), "8.8.8.8", "9.9.9.9"},
	} {
		t.Run(tc.expected, func(t *testing.T) {
			program, _ := sourceForRevision(tc.revision)
			cmd := exec.Command(python, "-I", "-c", script, tc.expected, tc.other)
			cmd.Stdin = strings.NewReader(program)
			if output, err := cmd.CombinedOutput(); err != nil {
				t.Fatalf("DNS regression: %v\n%s", err, output)
			}
		})
	}
}
