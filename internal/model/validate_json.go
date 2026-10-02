package model

import (
	"encoding/json"
	"fmt"
)

// ValidateArtifactJSON checks required fields before Go's zero values can hide
// missing or null data. Unknown additions remain compatible with schema 1.
func ValidateArtifactJSON(data []byte) error {
	object := func(data json.RawMessage, at string, nullable []string, keys ...string) (map[string]json.RawMessage, error) {
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(data, &fields); err != nil || fields == nil {
			return nil, fmt.Errorf("%s: se esperaba un objeto", at)
		}
		for _, key := range keys {
			value, ok := fields[key]
			allowNull := false
			for _, allowed := range nullable {
				if key == allowed {
					allowNull = true
				}
			}
			if !ok || (!allowNull && string(value) == "null") {
				return nil, fmt.Errorf("%s.%s: falta un campo obligatorio", at, key)
			}
		}
		return fields, nil
	}
	run, err := object(data, "run", nil, "schema_version", "run_id", "engine_version", "started_at", "finished_at", "status", "exam", "inventory", "plan_hash", "plan", "students")
	if err != nil {
		return err
	}
	for _, key := range []string{"exam", "inventory"} {
		if _, err := object(run[key], key, nil, "path", "sha256"); err != nil {
			return err
		}
	}
	plan, err := object(run["plan"], "plan", nil, "check_count", "total_weight", "check_ids", "concurrency", "host_concurrency")
	if err != nil {
		return err
	}
	// Omission preserves older artifacts; an explicit budget must satisfy
	// the published schema, rather than becoming Go's default zero.
	if raw, exists := plan["evidence_bytes_per_field"]; exists {
		var limit int
		if string(raw) == "null" || json.Unmarshal(raw, &limit) != nil || limit < 1 || limit > MaxStreamBytes {
			return fmt.Errorf("plan.evidence_bytes_per_field: límite inválido")
		}
	}
	if raw, exists := run["retry_of"]; exists {
		if _, err := object(raw, "retry_of", nil, "run_id", "artifact", "run_at", "students", "checks"); err != nil {
			return err
		}
	}
	if raw, exists := run["warnings"]; exists {
		var warnings []json.RawMessage
		if string(raw) == "null" || json.Unmarshal(raw, &warnings) != nil {
			return fmt.Errorf("warnings: se esperaba una lista")
		}
		for _, warning := range warnings {
			if _, err := object(warning, "warning", nil, "scope", "code", "message"); err != nil {
				return err
			}
		}
	}
	var students []json.RawMessage
	if err := json.Unmarshal(run["students"], &students); err != nil {
		return err
	}
	for i, data := range students {
		at := fmt.Sprintf("students[%d]", i+1)
		s, err := object(data, at, []string{"checks"}, "student_id", "name", "status", "started_at", "finished_at", "score", "checks")
		if err != nil {
			return err
		}
		if _, err := object(s["score"], at+".score", []string{"provisional_score", "final_score"}, "obtained", "evaluable", "total", "unevaluated", "provisional_score", "final_score", "status"); err != nil {
			return err
		}
		var checks []json.RawMessage
		if err := json.Unmarshal(s["checks"], &checks); err != nil {
			return err
		}
		for j, data := range checks {
			where := fmt.Sprintf("%s.checks[%d]", at, j+1)
			c, err := object(data, where, []string{"execution", "assertion"}, "check_id", "group", "description", "weight", "status", "cause", "execution", "assertion")
			if err != nil {
				return err
			}
			if raw, exists := c["previous"]; exists {
				if _, err := object(raw, where+".previous", nil, "run_id", "status", "cause", "finished_at"); err != nil {
					return err
				}
			}
			if string(c["assertion"]) != "null" {
				a, err := object(c["assertion"], where+".assertion", nil, "kind", "expected", "found", "matched")
				if err != nil {
					return err
				}
				if raw, exists := a["evidence_truncated"]; exists && string(raw) == "null" {
					return fmt.Errorf("%s.assertion.evidence_truncated: marcador inválido", where)
				}
			}
			if string(c["execution"]) != "null" {
				e, err := object(c["execution"], where+".execution", []string{"command", "exit_code"}, "host", "address", "user", "transport", "command", "started_at", "duration_ms", "completed", "exit_code", "overflow", "stdout", "stderr", "connect_attempts", "command_attempts", "remote_process")
				if err != nil {
					return err
				}
				if string(e["command"]) != "null" {
					var args []json.RawMessage
					if err := json.Unmarshal(e["command"], &args); err != nil {
						return err
					}
					for _, arg := range args {
						if string(arg) == "null" {
							return fmt.Errorf("%s.command: argumento inválido", where)
						}
					}
				}
				for _, key := range []string{"stdout", "stderr"} {
					if _, err := object(e[key], where+"."+key, nil, "text", "bytes", "bytes_total", "truncated"); err != nil {
						return err
					}
				}
			}
		}
	}
	return nil
}
