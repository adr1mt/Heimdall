package main

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// Both runtimes consume the same artifacts and expected decisions.
func TestArtifactAcceptanceCorpus(t *testing.T) {
	data, err := os.ReadFile("../../testdata/artifacts/corpus.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name     string          `json:"name"`
		Accept   bool            `json:"accept"`
		Artifact json.RawMessage `json:"artifact"`
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	if len(cases) == 0 {
		t.Fatal("empty acceptance corpus")
	}
	for _, c := range cases {
		t.Run(c.Name, func(t *testing.T) {
			_, err := readArtifactFrom(c.Name, strings.NewReader(string(c.Artifact)))
			if (err == nil) != c.Accept {
				t.Fatalf("accept=%v, error=%v", c.Accept, err)
			}
		})
	}
}
