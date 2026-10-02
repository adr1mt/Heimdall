package report

import (
	"encoding/json"
	"unicode/utf8"

	"heimdall/internal/model"
)

// The same allowance is used for every check and both streams. It depends on
// the original PLAN, never on completion order or a student's academic status.
// Comparisons already happened against the full captured SSH/inventory data.
func boundEvidence(run *model.RunResult) {
	cells := len(run.Students) * run.Plan.CheckCount
	if cells < 1 {
		cells = 1
	}
	limit := (16 << 20) / (3 * cells)
	if original := run.Plan.EvidenceBytesPerField; original > 0 && original < limit {
		limit = original
	}
	if limit > 65536 {
		limit = 65536
	}
	changed := false
	clip := func(text *string, budget int) bool {
		prefix, cut := jsonPrefix(*text, budget)
		if cut {
			*text = prefix
			changed = true
		}
		return cut
	}
	for i := range run.Students {
		for j := range run.Students[i].Checks {
			c := &run.Students[i].Checks[j]
			clip(&c.Detail, 1024)
			if c.Previous != nil {
				clip(&c.Previous.Detail, 1024)
			}
			if e := c.Execution; e != nil {
				for _, stream := range []*model.Stream{&e.Stdout, &e.Stderr} {
					if clip(&stream.Text, limit) {
						if kept := int64(len(stream.Text)); kept < stream.Bytes {
							stream.Bytes = kept
						}
						stream.Truncated = true
					}
				}
			}
			if a := c.Assertion; a != nil {
				if clip(&a.Found, limit) {
					a.EvidenceTruncated = true
				}
				if clip(&a.Where, 1024) {
					a.EvidenceTruncated = true
				}
			}
		}
	}
	// Warnings are explanatory runtime data, not grades or provenance links.
	maxWarnings := 2*cells + 16
	if len(run.Warnings) > maxWarnings {
		run.Warnings = run.Warnings[:maxWarnings]
		changed = true
	}
	for i := range run.Warnings {
		clip(&run.Warnings[i].Message, 1024)
		clip(&run.Warnings[i].Scope, 1024)
	}
	if changed {
		for _, warning := range run.Warnings {
			if warning.Code == "EVIDENCE_TRUNCATED" {
				return
			}
		}
		run.Warnings = append(run.Warnings, model.Warning{Scope: "run", Code: "EVIDENCE_TRUNCATED", Message: "Se recortó evidencia al guardar para respetar el presupuesto del resultado. Las aserciones se comprobaron antes del recorte y las notas no han cambiado. El mismo límite se aplica a todas las comprobaciones."})
	}
}

// JSON control characters may take six bytes for each input byte. Cut on a
// UTF-8 boundary using the serialized size, rather than the raw text length.
func jsonPrefix(text string, limit int) (string, bool) {
	encoded, _ := json.Marshal(text)
	if len(encoded) <= limit {
		return text, false
	}
	low, high := 0, len(text)
	for low < high {
		mid := (low + high + 1) / 2
		encoded, _ = json.Marshal(text[:mid])
		if len(encoded) <= limit {
			low = mid
		} else {
			high = mid - 1
		}
	}
	for low > 0 && !utf8.ValidString(text[:low]) {
		low--
	}
	return text[:low], true
}
