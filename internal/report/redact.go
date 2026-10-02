package report

import (
	"encoding/json"
	"fmt"
	"sort"
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

	// Longest first prevents one secret from exposing the suffix of another.
	secrets = append([]string(nil), secrets...)
	sort.Slice(secrets, func(i, j int) bool { return len(secrets[i]) > len(secrets[j]) })
	hits := 0
	scrub := func(s *string) {
		for _, secret := range secrets {
			if secret != "" && strings.Contains(*s, secret) {
				*s = strings.ReplaceAll(*s, secret, Redacted)
				hits++
			}
		}
	}

	// Identity keys, enum values and content digests are structural references,
	// not display text. Keeping them stable preserves retry/consolidation links.
	scrub(&out.Exam.Path)
	scrub(&out.Exam.Version)
	scrub(&out.Inventory.Path)
	scrub(&out.Inventory.Version)
	scrub(&out.EngineVersion)
	if out.RetryOf != nil {
		scrub(&out.RetryOf.Artifact)
	}
	for i := range out.Students {
		st := &out.Students[i]
		scrub(&st.Name)
		scrub(&st.MoodleID)
		scrub(&st.Reason)
		for j := range st.Checks {
			c := &st.Checks[j]
			scrub(&c.Group)
			scrub(&c.Description)
			scrub(&c.Detail)
			if e := c.Execution; e != nil {
				scrub(&e.Host)
				scrub(&e.Address)
				scrub(&e.User)
				for k := range e.Command {
					scrub(&e.Command[k])
				}
				scrub(&e.Stdout.Text)
				scrub(&e.Stderr.Text)
			}
			if a := c.Assertion; a != nil {
				scrub(&a.Expected)
				scrub(&a.Found)
				scrub(&a.Where)
			}
			if pv := c.Previous; pv != nil {
				scrub(&pv.Detail)
			}
		}
	}
	for i := range out.Warnings {
		scrub(&out.Warnings[i].Message)
		scrub(&out.Warnings[i].Scope)
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
