package report

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"heimdall/internal/engine"
	"heimdall/internal/model"
	"heimdall/internal/plan"
)

func TestLargeResultBudgetPreservesGradesAndValidEvidence(t *testing.T) {
	const students, checks = 30, 20
	p := &plan.Plan{Hash: "hash", Exam: model.SourceRef{Path: "examen.yaml", SHA256: "hash"}, Inventory: model.SourceRef{Path: "aula.yaml", SHA256: "hash"}, Summary: model.PlanSummary{CheckCount: checks, TotalWeight: checks, Concurrency: 4, HostConcurrency: 4}}
	value := strings.Repeat("\x00", 65530) + "éend"
	for i := 0; i < checks; i++ {
		p.Summary.CheckIDs = append(p.Summary.CheckIDs, fmt.Sprintf("c%d", i))
	}
	for i := 0; i < students; i++ {
		s := plan.StudentPlan{ID: fmt.Sprintf("fake%d", i), Name: "Ficticio"}
		for _, id := range p.Summary.CheckIDs {
			expected := "end"
			s.Checks = append(s.Checks, plan.ResolvedCheck{ID: id, Weight: 1, Value: value, Contains: &expected, Timeout: time.Second})
		}
		p.Students = append(p.Students, s)
	}
	run := engine.Run(context.Background(), p, engine.Options{RunID: "R1", EngineVersion: "test"})
	// Fill both retained streams to their legal maximum. This does not alter
	// the assertion already computed against inventory data.
	for i := range run.Students {
		for j := range run.Students[i].Checks {
			run.Students[i].Checks[j].Execution.Stderr = run.Students[i].Checks[j].Execution.Stdout
		}
	}
	writer, _ := New(t.TempDir(), run.RunID, nil)
	path, err := writer.WriteFinal(run)
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(data) > model.MaxArtifactBytes {
		t.Fatalf("result too large: %d", len(data))
	}
	saved := &model.RunResult{}
	if err := json.Unmarshal(data, saved); err != nil {
		t.Fatal(err)
	}
	if err := model.ValidateArtifactJSON(data); err != nil {
		t.Fatal(err)
	}
	if err := model.ValidateArtifact(saved); err != nil {
		t.Fatal(err)
	}
	if len(saved.Warnings) != 1 || saved.Warnings[0].Code != "EVIDENCE_TRUNCATED" {
		t.Fatal("missing truncation notice")
	}
	for i, s := range saved.Students {
		if *s.Score.Final != 100 {
			t.Fatal("evidence budget changed grade")
		}
		for j, c := range s.Checks {
			if c.Status != model.Pass || c.Assertion.Found != "end" || !c.Execution.Stdout.Truncated || !utf8.ValidString(c.Execution.Stdout.Text) {
				t.Fatal("invalid retained evidence")
			}
			if run.Students[i].Checks[j].Execution.Stdout.Truncated {
				t.Fatal("writer modified engine data")
			}
		}
	}
}

func TestJSONPrefixHandlesEscapingUTF8AndBoundary(t *testing.T) {
	for _, text := range []string{strings.Repeat("é", 100), strings.Repeat("\x00", 100), strings.Repeat("<", 100)} {
		for _, limit := range []int{2, 3, 8, 100, 1024} {
			prefix, cut := jsonPrefix(text, limit)
			encoded, _ := json.Marshal(prefix)
			if len(encoded) > limit || !utf8.ValidString(prefix) || !strings.HasPrefix(text, prefix) {
				t.Fatalf("invalid prefix %q", prefix)
			}
			if cut != (prefix != text) {
				t.Fatal("incorrect cut flag")
			}
		}
	}
}

func TestRetryKeepsOriginalEvidenceAllowance(t *testing.T) {
	run := runWith("R2", student("fake", model.StudentOK))
	run.Plan.EvidenceBytesPerField = 128
	run.Students[0].Checks[0].Execution = &model.ExecutionResult{Stdout: model.Stream{Text: strings.Repeat("x", 1000), Bytes: 1000, BytesTotal: 1000}}
	boundEvidence(run)
	encoded, _ := json.Marshal(run.Students[0].Checks[0].Execution.Stdout.Text)
	if len(encoded) > 128 {
		t.Fatal("retry enlarged the evidence allowance")
	}
}

func TestRedactionPrecedesEvidenceCutAndDoesNotMutateInput(t *testing.T) {
	run := runWith("R1", student("fake", model.StudentOK))
	run.Plan.EvidenceBytesPerField = 20
	value := strings.Repeat("x", 12) + "SECRET_FICTITIOUS_BOUNDARY" + strings.Repeat("x", 100)
	run.Students[0].Checks[0].Execution = &model.ExecutionResult{Stdout: model.Stream{Text: value, Bytes: int64(len(value)), BytesTotal: int64(len(value))}, Command: []string{"SECRET_FICTITIOUS_BOUNDARY"}}
	w, _ := New(t.TempDir(), run.RunID, []string{"SECRET_FICTITIOUS_BOUNDARY"})
	path, err := w.WriteFinal(run)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	var saved model.RunResult
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatal(err)
	}
	e := saved.Students[0].Checks[0].Execution
	if strings.Contains(e.Stdout.Text, "SECRET") || strings.Contains(e.Command[0], "SECRET") {
		t.Fatal("secret prefix exposed at evidence boundary")
	}
	if run.Students[0].Checks[0].Execution.Stdout.Text != value || run.Students[0].Checks[0].Execution.Command[0] != "SECRET_FICTITIOUS_BOUNDARY" {
		t.Fatal("redaction mutated original")
	}
}
