package events

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"heimdall/internal/model"
)

// fixed makes the stream reproducible: the tests are about the contract, not
// about the clock.
func fixed(t *testing.T, w *bytes.Buffer, secrets ...string) *Emitter {
	t.Helper()
	e := New(w, secrets)
	e.now = func() time.Time { return time.Date(2026, 9, 20, 10, 0, 0, 0, time.UTC) }
	return e
}

func lines(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, line := range strings.Split(strings.TrimRight(buf.String(), "\n"), "\n") {
		if line == "" {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(line), &m); err != nil {
			t.Fatalf("la línea %q no es JSON: %s", line, err)
		}
		out = append(out, m)
	}
	return out
}

// Every event is one line of JSON and every line carries the envelope. A
// consumer that reads line by line must never need to look ahead.
func TestEveryEventIsOneSelfDescribingLine(t *testing.T) {
	var buf bytes.Buffer
	e := fixed(t, &buf)
	e.RunStart(RunStart{RunID: "R", Plan: model.PlanSummary{CheckCount: 2}})
	e.StudentStart(StudentStart{StudentID: "alu1"})
	e.CheckEnd(CheckEnd{StudentID: "alu1", CheckID: "c1", Status: model.Pass, Cause: model.CauseNone})
	e.StudentEnd(StudentEnd{StudentID: "alu1", Status: model.StudentOK})
	e.RunEnd(RunEnd{Status: model.RunComplete, ExitCode: 0, Artifact: "var/run-R.json"})

	got := lines(t, &buf)
	want := []string{"run.start", "student.start", "check.end", "student.end", "run.end"}
	if len(got) != len(want) {
		t.Fatalf("se emitieron %d eventos, se esperaban %d:\n%s", len(got), len(want), buf.String())
	}
	for i, name := range want {
		if got[i]["event"] != name {
			t.Errorf("evento %d = %v, se esperaba %s", i, got[i]["event"], name)
		}
		if seq := got[i]["seq"].(float64); int(seq) != i+1 {
			t.Errorf("%s: seq = %v, se esperaba %d", name, seq, i+1)
		}
		if got[i]["ts"] == nil {
			t.Errorf("%s: sin marca de tiempo", name)
		}
	}
}

// The first line declares the contract and the denominator. A consumer that
// does not recognise the version must be able to say so before anything else
// happens.
func TestRunStartDeclaresTheContractAndTheDenominator(t *testing.T) {
	var buf bytes.Buffer
	e := fixed(t, &buf)
	e.RunStart(RunStart{
		RunID:          "R",
		Plan:           model.PlanSummary{CheckCount: 5, TotalWeight: 6, CheckIDs: []string{"a", "b", "c", "d", "e"}},
		ExpectedChecks: 10,
		Students: []StudentRef{
			{StudentID: "alu1"},
			{StudentID: "alu2", Excluded: true},
		},
	})

	first := lines(t, &buf)[0]
	if v := int(first["contract_version"].(float64)); v != ContractVersion {
		t.Errorf("contract_version = %d, se esperaba %d", v, ContractVersion)
	}
	plan := first["plan"].(map[string]any)
	if n := int(plan["check_count"].(float64)); n != 5 {
		t.Errorf("check_count = %d, se esperaba 5", n)
	}
	if n := int(first["expected_checks"].(float64)); n != 10 {
		t.Errorf("expected_checks = %d, se esperaba 10", n)
	}
	if n := len(first["students"].([]any)); n != 2 {
		t.Errorf("se anunciaron %d alumnos, se esperaban 2", n)
	}
}

// The stream carries the two axes of the model, not one flattened value: an
// UNEVALUATED check travels with its technical cause or the GUI is back to
// guessing.
func TestCheckEndCarriesStatusAndCause(t *testing.T) {
	var buf bytes.Buffer
	e := fixed(t, &buf)
	e.CheckEnd(CheckEndOf("alu1", model.CheckResult{
		CheckID: "kea-activo",
		Weight:  2,
		Status:  model.Unevaluated,
		Cause:   model.CauseConnectFailed,
		Detail:  "no se pudo conectar",
	}))

	ev := lines(t, &buf)[0]
	if ev["status"] != string(model.Unevaluated) || ev["cause"] != string(model.CauseConnectFailed) {
		t.Errorf("status/cause = %v/%v, se esperaba UNEVALUATED/CONNECT_FAILED", ev["status"], ev["cause"])
	}
	if ev["duration_ms"] != nil {
		t.Errorf("duration_ms = %v: sin ejecución no hay duración", ev["duration_ms"])
	}
	if ev["detail"] != "no se pudo conectar" {
		t.Errorf("detail = %v", ev["detail"])
	}
}

// The student's output never travels on this channel: it is untrusted data
// and it is unbounded. The artifact is where it lives, capped.
func TestTheStreamNeverCarriesTheStudentsOutput(t *testing.T) {
	var buf bytes.Buffer
	e := fixed(t, &buf)
	huge := strings.Repeat("x", 100_000)
	code := 0
	e.CheckEnd(CheckEndOf("alu1", model.CheckResult{
		CheckID: "c1",
		Status:  model.Fail,
		Cause:   model.CauseNone,
		Execution: &model.ExecutionResult{
			Completed:  true,
			ExitCode:   &code,
			DurationMS: 42,
			Stdout:     model.Stream{Text: huge, Bytes: int64(len(huge)), BytesTotal: int64(len(huge))},
		},
		Assertion: &model.AssertionResult{Kind: "contains", Expected: "algo", Found: huge},
	}))

	if strings.Contains(buf.String(), "xxxx") {
		t.Error("la salida del alumno ha llegado al flujo de eventos")
	}
	if n := buf.Len(); n > 500 {
		t.Errorf("el evento ocupa %d bytes: debe ser acotado", n)
	}
	ev := lines(t, &buf)[0]
	if int(ev["duration_ms"].(float64)) != 42 {
		t.Errorf("duration_ms = %v, se esperaba 42", ev["duration_ms"])
	}
}

// Second line of defence, the same one the artifact writer has. A secret
// cannot reach a message; if one does, it is replaced and not published.
func TestASecretIsNeverPublished(t *testing.T) {
	const secret = "ficticia-12345"
	var buf bytes.Buffer
	e := fixed(t, &buf, secret)
	e.CheckEnd(CheckEnd{StudentID: "alu1", CheckID: "c1", Detail: "fallo con " + secret})
	e.RunEnd(RunEnd{Warnings: []model.Warning{{Code: "X", Message: "y " + secret}}})

	if strings.Contains(buf.String(), secret) {
		t.Fatalf("el secreto aparece en el flujo:\n%s", buf.String())
	}
	if !strings.Contains(buf.String(), redacted) {
		t.Error("se ocultó el secreto sin decirlo")
	}
}

// The workers run in parallel: two events must never end up on the same line.
func TestConcurrentEventsDoNotInterleave(t *testing.T) {
	var buf bytes.Buffer
	e := fixed(t, &buf)

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			e.CheckEnd(CheckEnd{StudentID: "alu1", CheckID: "c1", Status: model.Pass})
		}()
	}
	wg.Wait()

	got := lines(t, &buf)
	if len(got) != 50 {
		t.Fatalf("se leyeron %d eventos, se esperaban 50", len(got))
	}
	seen := map[int]bool{}
	for _, ev := range got {
		seen[int(ev["seq"].(float64))] = true
	}
	if len(seen) != 50 {
		t.Errorf("hay seq repetidos: %d distintos de 50", len(seen))
	}
}

// A consumer that stops reading must not turn into a run that stops
// reporting: the failure is remembered and the caller says it on stderr.
func TestAWriteFailureIsRemembered(t *testing.T) {
	e := New(failingWriter{}, nil)
	e.RunStart(RunStart{RunID: "R"})
	if e.Err() == nil {
		t.Fatal("un fallo de escritura pasó en silencio")
	}
}

func TestBufferedStreamKeepsTheNormalContract(t *testing.T) {
	var buf bytes.Buffer
	e := NewBuffered(&buf, nil)
	e.RunStart(RunStart{RunID: "R"})
	e.CheckEnd(CheckEnd{StudentID: "a", CheckID: "c"})
	e.RunEnd(RunEnd{Status: model.RunComplete})
	e.Finish(time.Second)
	if err := e.Err(); err != nil {
		t.Fatal(err)
	}
	got := lines(t, &buf)
	if len(got) != 3 || got[0]["event"] != "run.start" || got[1]["event"] != "check.end" || got[2]["event"] != "run.end" {
		t.Fatalf("unexpected buffered stream: %s", buf.String())
	}
}

func TestBufferedStreamDoesNotWaitForBlockedWriter(t *testing.T) {
	release := make(chan struct{})
	defer close(release)
	e := NewBuffered(waitingWriter{release}, nil)
	for i := 0; i < maxQueuedLines+10; i++ {
		e.CheckEnd(CheckEnd{StudentID: "a", CheckID: "c"})
	}
	e.Finish(10 * time.Millisecond)
	if err := e.Err(); err == nil || !strings.Contains(err.Error(), "progreso") {
		t.Fatalf("blocked progress was not reported: %v", err)
	}
}

type waitingWriter struct{ release <-chan struct{} }

func (w waitingWriter) Write(p []byte) (int, error) {
	<-w.release
	return len(p), nil
}

type failingWriter struct{}

func (failingWriter) Write([]byte) (int, error) { return 0, errors.New("tubería rota") }

// The tally is the artifact's, so the stream cannot say something the file
// does not.
func TestCountsOfTalliesTheArtifact(t *testing.T) {
	run := &model.RunResult{Students: []model.StudentResult{
		{Checks: []model.CheckResult{{Status: model.Pass}, {Status: model.Fail}}},
		{Checks: []model.CheckResult{{Status: model.Unevaluated}, {Status: model.Pass}}},
	}}
	got := CountsOf(run)
	want := Counts{Students: 2, Pass: 2, Fail: 1, Unevaluated: 1}
	if got != want {
		t.Errorf("counts = %+v, se esperaba %+v", got, want)
	}
}
