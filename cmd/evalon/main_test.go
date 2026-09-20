package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestRunSubcommands(t *testing.T) {
	cases := []struct {
		name     string
		args     []string
		wantExit int
		wantOut  string
		wantErr  string
	}{
		{"version", []string{"version"}, exitOK, version, ""},
		{"run not implemented", []string{"run"}, exitInvalidConfig, "", "no implementado"},
		{"check without a directory", []string{"check"}, exitInvalidConfig, "", "uso: evalon check"},
		{"no args", nil, exitInvalidConfig, "", "uso: evalon"},
		{"unknown", []string{"nope"}, exitInvalidConfig, "", "subcomando desconocido"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			got := run(tc.args, &stdout, &stderr)
			if got != tc.wantExit {
				t.Errorf("exit = %d, want %d", got, tc.wantExit)
			}
			if tc.wantOut != "" && !strings.Contains(stdout.String(), tc.wantOut) {
				t.Errorf("stdout = %q, want it to contain %q", stdout.String(), tc.wantOut)
			}
			if tc.wantErr != "" && !strings.Contains(stderr.String(), tc.wantErr) {
				t.Errorf("stderr = %q, want it to contain %q", stderr.String(), tc.wantErr)
			}
		})
	}
}

// TestExitCodesAreDiscriminant guards the contract with the GUI: these four
// numbers must never collide, and 1 must stay free of meaning.
func TestExitCodesAreDiscriminant(t *testing.T) {
	seen := map[int]string{}
	for name, code := range map[string]int{
		"exitOK":            exitOK,
		"exitInvalidConfig": exitInvalidConfig,
		"exitPartial":       exitPartial,
		"exitCancelled":     exitCancelled,
	} {
		if code == 1 {
			t.Errorf("%s uses exit code 1, which is reserved as unspecified failure", name)
		}
		if other, dup := seen[code]; dup {
			t.Errorf("%s and %s share exit code %d", name, other, code)
		}
		seen[code] = name
	}
}
