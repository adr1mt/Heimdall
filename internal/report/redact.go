package report

import (
	"encoding/json"
	"fmt"
	"strings"

	"heimdall/internal/model"
)

// Redact returns a copy of run with every known secret value replaced, plus a
// warning if anything was replaced. The original is never modified: the
// engine keeps working with what it collected.
//
// This is the second line of defence, not the mechanism. A secret cannot
// reach a command in the first place, because ${MAYUSCULAS} is only valid in
// the authentication fields of the inventory. If this ever fires, something
// upstream is broken and the teacher has to know.
func Redact(run *model.RunResult, secrets []string) (*model.RunResult, error) {
	out, err := clone(run)
	if err != nil {
		return nil, err
	}
	if len(secrets) == 0 {
		return out, nil
	}

	hits := 0
	scrub := func(s *string) {
		for _, secret := range secrets {
			if strings.Contains(*s, secret) {
				*s = strings.ReplaceAll(*s, secret, Redacted)
				hits++
			}
		}
	}

	for i := range out.Students {
		st := &out.Students[i]
		for j := range st.Checks {
			c := &st.Checks[j]
			scrub(&c.Detail)
			if e := c.Execution; e != nil {
				for k := range e.Command {
					scrub(&e.Command[k])
				}
				scrub(&e.Stdout.Text)
				scrub(&e.Stderr.Text)
			}
			if a := c.Assertion; a != nil {
				scrub(&a.Expected)
				scrub(&a.Found)
			}
		}
	}
	for i := range out.Warnings {
		scrub(&out.Warnings[i].Message)
	}

	if hits > 0 {
		out.Warnings = append(out.Warnings, model.Warning{
			Scope: "run",
			Code:  WarnSecretRedacted,
			Message: fmt.Sprintf(
				"se ocultaron %d apariciones de una contraseña en el artefacto: revisa el examen, un secreto no debería llegar hasta aquí", hits),
		})
	}
	return out, nil
}

// clone deep-copies the artifact through its own JSON encoding, which is the
// contract this package writes anyway.
func clone(run *model.RunResult) (*model.RunResult, error) {
	data, err := json.Marshal(run)
	if err != nil {
		return nil, fmt.Errorf("report: no se pudo copiar el artefacto: %w", err)
	}
	var out model.RunResult
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("report: no se pudo copiar el artefacto: %w", err)
	}
	return &out, nil
}
