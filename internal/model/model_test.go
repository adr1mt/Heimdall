package model

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"
)

const goldenPath = "testdata/run-example.json"

func loadGolden(t *testing.T) (raw []byte, run RunResult) {
	t.Helper()
	raw, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields() // a key the model cannot hold is a broken model
	if err := dec.Decode(&run); err != nil {
		t.Fatalf("decode golden: %v", err)
	}
	return raw, run
}

// TestRoundTrip is the acceptance criterion of T002: the worked example of
// docs/design/04-MODELO-RESULTADO.md deserialises, serialises again and comes
// back byte for byte. That pins the field names, the field order, the null
// fields and the omitted ones all at once.
func TestRoundTrip(t *testing.T) {
	raw, run := loadGolden(t)

	got, err := MarshalCanonical(run)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if string(got) != string(raw) {
		t.Errorf("round trip changed the artifact.\n--- got ---\n%s\n--- want ---\n%s", got, raw)
	}
}

// TestNullablesStayNull guards the rule that matters academically: an absent
// grade is null, never a zero. A 0 would read as "the student got nothing".
func TestNullablesStayNull(t *testing.T) {
	_, run := loadGolden(t)

	incomplete := run.Students[1]
	if incomplete.Score.Final != nil {
		t.Errorf("final_score = %v, want null for an INCOMPLETE student", *incomplete.Score.Final)
	}
	if incomplete.Score.Provisional == nil || *incomplete.Score.Provisional != 100 {
		t.Errorf("provisional_score = %v, want 100", incomplete.Score.Provisional)
	}

	out, err := MarshalCanonical(incomplete.Score)
	if err != nil {
		t.Fatalf("marshal score: %v", err)
	}
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(out, &keys); err != nil {
		t.Fatalf("unmarshal score: %v", err)
	}
	for _, k := range []string{"provisional_score", "final_score"} {
		v, ok := keys[k]
		if !ok {
			t.Errorf("%s is missing; a nullable field must always be present", k)
			continue
		}
		if string(v) == "0" {
			t.Errorf("%s serialised as 0; an absent grade must be null", k)
		}
	}
	if string(keys["final_score"]) != "null" {
		t.Errorf("final_score = %s, want null", keys["final_score"])
	}
}

// TestAbsentLayersAreNull guards the layer separation in the artifact: a check
// that never ran carries no execution, and one without a complete execution
// carries no assertion.
func TestAbsentLayersAreNull(t *testing.T) {
	_, run := loadGolden(t)
	checks := run.Students[1].Checks

	notRun := checks[3]
	if notRun.Cause != CauseNotRun {
		t.Fatalf("cause = %q, want NOT_RUN", notRun.Cause)
	}
	if notRun.Execution != nil || notRun.Assertion != nil {
		t.Errorf("a check that never ran carries execution=%v assertion=%v, want both null",
			notRun.Execution, notRun.Assertion)
	}

	timedOut := checks[1]
	if timedOut.Execution == nil {
		t.Fatal("a timed out check must keep its execution: it is the evidence")
	}
	if timedOut.Execution.Completed {
		t.Error("completed = true on a timed out execution")
	}
	if timedOut.Execution.ExitCode != nil {
		t.Errorf("exit_code = %d, want null when the execution did not complete", *timedOut.Execution.ExitCode)
	}
	if timedOut.Assertion != nil {
		t.Error("assertion is set without a complete execution; the layers are crossed")
	}
	if timedOut.Execution.RemoteProcess != RemoteKilledRemote {
		t.Errorf("remote_process = %q, want KILLED_REMOTE", timedOut.Execution.RemoteProcess)
	}
}

// TestOptionalsAreOmitted checks the other half of the contract: a field that
// is empty and optional must not appear at all.
func TestOptionalsAreOmitted(t *testing.T) {
	_, run := loadGolden(t)

	// A PASS carries no detail, and this assertion has no `where`.
	pass := run.Students[0].Checks[1]
	out, err := MarshalCanonical(pass)
	if err != nil {
		t.Fatalf("marshal check: %v", err)
	}
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(out, &keys); err != nil {
		t.Fatalf("unmarshal check: %v", err)
	}
	if _, ok := keys["detail"]; ok {
		t.Error("detail is present on a PASS check; it is optional and empty")
	}

	var assertionKeys map[string]json.RawMessage
	if err := json.Unmarshal(keys["assertion"], &assertionKeys); err != nil {
		t.Fatalf("unmarshal assertion: %v", err)
	}
	if _, ok := assertionKeys["where"]; ok {
		t.Error("where is present while empty; it is optional")
	}

	// Mandatory fields stay even when zero: an empty stderr is a fact.
	var execKeys map[string]json.RawMessage
	if err := json.Unmarshal(keys["execution"], &execKeys); err != nil {
		t.Fatalf("unmarshal execution: %v", err)
	}
	for _, k := range []string{"stderr", "connect_attempts", "command_attempts"} {
		if _, ok := execKeys[k]; !ok {
			t.Errorf("%s is missing; it is mandatory even when zero", k)
		}
	}
}

// TestCommandIsNotHTMLEscaped keeps `ip a show` output and shell-looking
// arguments readable in the artifact instead of turning into < noise.
func TestCommandIsNotHTMLEscaped(t *testing.T) {
	raw, _ := loadGolden(t)
	if !bytes.Contains(raw, []byte("<BROADCAST,MULTICAST,UP,LOWER_UP>")) {
		t.Fatal("the golden lost its angle brackets; the escaping test is moot")
	}
}
