package model

import (
	"fmt"
	"math"
)

// ValidateArtifact checks the facts that support a grade before an artifact
// is used for retries or sessions. It detects corruption, not authenticity.
func ValidateArtifact(run *RunResult) error {
	bad := func(at, why string) error { return fmt.Errorf("resultado incoherente en %s: %s", at, why) }
	if run == nil || run.SchemaVersion != SchemaVersion {
		return bad("schema_version", "versión no soportada")
	}
	if run.RunID == "" || run.PlanHash == "" || run.EngineVersion == "" || run.StartedAt.IsZero() || run.FinishedAt.IsZero() || run.FinishedAt.Before(run.StartedAt) {
		return bad("run", "identidad o fechas incompletas")
	}
	if run.Exam.Path == "" || run.Exam.SHA256 == "" || run.Inventory.Path == "" || run.Inventory.SHA256 == "" {
		return bad("sources", "referencias incompletas")
	}
	p := run.Plan
	if p.CheckCount < 1 || len(p.CheckIDs) != p.CheckCount || !finiteWeight(p.TotalWeight) || p.TotalWeight <= 0 || p.Concurrency < 1 || p.HostConcurrency < 1 {
		return bad("plan", "cantidades inválidas")
	}
	if p.EvidenceBytesPerField < 0 || p.EvidenceBytesPerField > 65536 {
		return bad("plan.evidence_bytes_per_field", "límite inválido")
	}
	ids := map[string]bool{}
	for _, id := range p.CheckIDs {
		if id == "" || ids[id] {
			return bad("plan.check_ids", "identificador vacío o repetido")
		}
		ids[id] = true
	}
	if len(run.Students) == 0 {
		return bad("students", "lista vacía")
	}
	restored := false
	for _, w := range run.Warnings {
		if w.Code == "RESTORED_FROM_BACKUP" {
			restored = true
		}
	}
	students := map[string]bool{}
	weights := map[string]float64{}
	for _, s := range run.Students {
		at := "student:" + s.StudentID
		if s.StudentID == "" || students[s.StudentID] {
			return bad(at, "identificador vacío o repetido")
		}
		students[s.StudentID] = true
		if s.StartedAt.IsZero() || s.FinishedAt.IsZero() || s.FinishedAt.Before(s.StartedAt) {
			return bad(at, "fechas inválidas")
		}
		if s.Status == StudentExcluded {
			expected := Score{Total: p.TotalWeight, Status: ScoreExcluded}
			if len(s.Checks) != 0 || !artifactScoresEqual(s.Score, expected) {
				return bad(at, "excluido con comprobaciones o nota")
			}
			continue
		}
		if len(s.Checks) != p.CheckCount {
			return bad(at, "faltan comprobaciones del PLAN")
		}
		var total float64
		for i, c := range s.Checks {
			where := at + "/check:" + c.CheckID
			if c.CheckID != p.CheckIDs[i] || !finiteWeight(c.Weight) {
				return bad(where, "id, orden o peso inválido")
			}
			if weight, ok := weights[c.CheckID]; ok && weight != c.Weight {
				return bad(where, "peso distinto entre alumnos")
			}
			weights[c.CheckID] = c.Weight
			total += c.Weight
			if !validStatusCause(c.Status, c.Cause) {
				return bad(where, "estado o causa inválidos")
			}
			if c.Previous != nil && (c.Previous.RunID == "" || !validStatusCause(c.Previous.Status, c.Previous.Cause)) {
				return bad(where, "procedencia inválida")
			}
			if c.Status != Unevaluated && !restored {
				status, cause, _ := Classify(c.Execution, c.Assertion, CauseNone)
				if status != c.Status || cause != CauseNone {
					return bad(where, "falta evidencia que sustente el resultado")
				}
			}
			if a := c.Assertion; a != nil {
				if (c.Status == Pass) != a.Matched {
					return bad(where, "aserción incoherente")
				}
				switch a.Kind {
				case "contains", "not_contains", "equals", "exit_code", "near":
				default:
					return bad(where, "aserción desconocida")
				}
			}
			if c.Status == Unevaluated && c.Assertion != nil {
				return bad(where, "sin evaluar con aserción")
			}
			if e := c.Execution; e != nil {
				if e.DurationMS < 0 || e.ConnectAttempts < 0 || e.CommandAttempts < 0 || (e.Completed && (e.ExitCode == nil || e.Overflow || e.RemoteProcess != RemoteFinished)) || (!e.Completed && e.ExitCode != nil) {
					return bad(where, "ejecución inválida")
				}
				if e.RemoteProcess != RemoteFinished && e.RemoteProcess != RemoteUnknown && e.RemoteProcess != RemoteKilledRemote {
					return bad(where, "proceso remoto inválido")
				}
				for _, stream := range []Stream{e.Stdout, e.Stderr} {
					if stream.Bytes < 0 || stream.Bytes > MaxStreamBytes || stream.BytesTotal < stream.Bytes || (stream.BytesTotal > stream.Bytes && !stream.Truncated) {
						return bad(where, "flujo inválido")
					}
				}
			}
		}
		if !closeWeight(total, p.TotalWeight) || s.Status != StudentStatusOf(s.Checks) || !artifactScoresEqual(s.Score, ComputeScore(p, s.Checks)) {
			return bad(at, "nota, pesos o estado no coinciden con las comprobaciones")
		}
	}
	if run.Status != RunCancelled && run.Status != RunStatusOf(run.Students) {
		return bad("status", "no coincide con los alumnos")
	}
	if r := run.RetryOf; r != nil && (r.RunID == "" || r.RunID == run.RunID || r.Artifact == "" || r.Students < 1 || r.Students > len(run.Students) || r.Checks < 1 || r.Checks > r.Students*p.CheckCount) {
		return bad("retry_of", "procedencia inválida")
	}
	return nil
}
func validStatusCause(status AcademicStatus, cause Cause) bool {
	if status == Pass || status == Fail {
		return cause == CauseNone
	}
	if status != Unevaluated {
		return false
	}
	switch cause {
	case CauseConnectFailed, CauseAuthFailed, CauseTimeout, CauseConnectionLost, CauseNotRun, CauseCancelled, CauseOutputOverflow, CauseEngineError:
		return true
	}
	return false
}
func finiteWeight(value float64) bool {
	return value >= 0 && !math.IsNaN(value) && !math.IsInf(value, 0)
}

// Relative tolerance is only for accumulated numbers, never for eligibility.
func closeWeight(a, b float64) bool {
	return finiteWeight(a) && finiteWeight(b) && (a == b || math.Abs(a-b) <= 1e-12*math.Max(math.Abs(a), math.Abs(b)))
}
func artifactIntsEqual(a, b *int) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
func artifactScoresEqual(a, b Score) bool {
	return a.Status == b.Status && closeWeight(a.Obtained, b.Obtained) && closeWeight(a.Evaluable, b.Evaluable) && closeWeight(a.Total, b.Total) && closeWeight(a.Unevaluated, b.Unevaluated) && artifactIntsEqual(a.Provisional, b.Provisional) && artifactIntsEqual(a.Final, b.Final)
}
