package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"heimdall/internal/model"
)

// Padding is streamed so the test can also prove the reader stops consuming
// an oversized source after the single byte needed to detect overflow.
type artifactPadding struct{ remaining, read int }

func (p *artifactPadding) Read(b []byte) (int, error) {
	if p.remaining == 0 {
		return 0, io.EOF
	}
	n := min(len(b), p.remaining)
	for i := range b[:n] {
		b[i] = ' '
	}
	p.remaining -= n
	p.read += n
	return n, nil
}

func TestArtifactReaderEnforcesActualBytes(t *testing.T) {
	data, err := model.MarshalCanonical(sessionRun("R1", 15, "fake", model.Pass, model.Pass))
	if err != nil {
		t.Fatal(err)
	}
	for _, extra := range []int{-1, 0, 1, 1000000} {
		t.Run(fmt.Sprintf("limit%+d", extra), func(t *testing.T) {
			padding := &artifactPadding{remaining: model.MaxArtifactBytes - len(data) + extra}
			run, err := readArtifactFrom("result.json", io.MultiReader(bytes.NewReader(data), padding))
			if extra <= 0 {
				if err != nil || run.RunID != "R1" {
					t.Fatalf("valid result at limit: %v", err)
				}
			} else {
				if err == nil || !strings.Contains(err.Error(), "64 MiB") || !strings.Contains(err.Error(), "result.json") {
					t.Fatalf("oversized result not rejected with context: %v", err)
				}
				if padding.read != model.MaxArtifactBytes+1-len(data) {
					t.Fatalf("read beyond detection byte: %d", padding.read)
				}
			}
		})
	}
}

func TestArtifactFileRejectsOversizeBeforeJSONParsing(t *testing.T) {
	path := filepath.Join(t.TempDir(), "large.json")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Truncate(model.MaxArtifactBytes + 1); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := readArtifact(path); err == nil || !strings.Contains(err.Error(), "64 MiB") {
		t.Fatalf("size must take precedence over invalid JSON: %v", err)
	}
}
