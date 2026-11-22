// Package plan reads the two declarative files the teacher writes,
// examen.yaml and aula.yaml, and turns them into Go values.
//
// YAML keys and Go field names are English. Teacher-facing messages remain
// Spanish. See ADR-0042 and
// docs/design/02-FORMATO.md.
//
// This package only parses. The nine semantic validations of the PLAN, the
// ${...} substitution and the hashes belong to the PLAN resolution (T005), and
// evaluating an assertion belongs to internal/assert.
package plan

import (
	"errors"
	"time"

	"go.yaml.in/yaml/v3"
)

// Defaults used when the exam does not set defaults. Both are explicit
// values, never silent: a malformed timeout is an error, not a fallback.
const (
	DefaultWeight  = 1.0
	DefaultTimeout = Duration(20 * time.Second)
)

// Duration is a YAML duration such as 20s or 10m.
type Duration time.Duration

func (d Duration) String() string { return time.Duration(d).String() }

// UnmarshalYAML rejects anything time.ParseDuration does not understand. A
// timeout the teacher mistyped must stop the run, not quietly become a
// default (T004 acceptance).
func (d *Duration) UnmarshalYAML(node *yaml.Node) error {
	if node.Kind != yaml.ScalarNode {
		return errf(node.Line, "la duración debe ser un valor como 20s o 10m")
	}
	v, err := time.ParseDuration(node.Value)
	if err != nil {
		return errf(node.Line, "duración inválida %q: se espera algo como 20s o 10m", node.Value)
	}
	if v <= 0 {
		return errf(node.Line, "duración inválida %q: debe ser mayor que cero", node.Value)
	}
	*d = Duration(v)
	return nil
}

// Exam is examen.yaml.
type Exam struct {
	Name     string   `yaml:"exam"`
	Version  int      `yaml:"version"`
	Hosts    []string `yaml:"hosts"`
	Defaults Defaults `yaml:"defaults"`
	Groups   []Group  `yaml:"groups"`
}

// Defaults is defaults: the values a check inherits when it says nothing.
type Defaults struct {
	Weight  *float64  `yaml:"weight"`
	Timeout *Duration `yaml:"timeout"`
	Sudo    *bool     `yaml:"sudo"`
}

// Group is a titled block of checks. The GUI shows the title (M-3).
type Group struct {
	Name   string  `yaml:"group"`
	Checks []Check `yaml:"checks"`
}

// Check is one check. Weight and Timeout are resolved against defaults at
// load time, so they are never nil once LoadExam returns.
type Check struct {
	ID          string    `yaml:"id"`
	Description string    `yaml:"description"`
	On          string    `yaml:"on"` // logical host, empty for a value: check
	Weight      *float64  `yaml:"weight"`
	Timeout     *Duration `yaml:"timeout"`

	Cmd   []string `yaml:"cmd"`   // argument vector, never a shell string
	Value string   `yaml:"value"` // check without a command (M-11)

	// Sudo runs Cmd through sudo with the host's own password on stdin
	// (ADR-0032). Nil means "not said"; defaults only fills it in for a
	// check that has a command.
	Sudo *bool `yaml:"sudo"`

	// Assertions. A pointer distinguishes "absent" from "expects the empty
	// string"; a check with none or with two incompatible ones is a PLAN
	// error, detected in T005.
	Contains    *string   `yaml:"contains"`
	NotContains *string   `yaml:"not_contains"`
	Equals      *string   `yaml:"equals"`
	ExitCode    *int      `yaml:"exit_code"`
	Near        *NearSpec `yaml:"near"`

	// Line of the check in examen.yaml, for the PLAN error messages.
	Line int `yaml:"-"`
}

// NearSpec is near: what grep -A N used to do (M-10).
type NearSpec struct {
	Anchor   string `yaml:"anchor"`
	Lines    int    `yaml:"lines"`
	Contains string `yaml:"contains"`
}

// Inventory is aula.yaml.
type Inventory struct {
	Name     string    `yaml:"classroom"`
	Version  int       `yaml:"version"`
	Common   Common    `yaml:"common"`
	Students []Student `yaml:"students"`
}

// Common is common: what every student's hosts inherit.
type Common struct {
	Hosts    map[string]Host `yaml:"hosts"`
	Timeouts Timeouts        `yaml:"timeouts"`
}

// Timeouts are the run-wide budgets.
type Timeouts struct {
	Connect *Duration `yaml:"connect"`
	Student *Duration `yaml:"student"`
}

// Host is where one logical host of one student lives. A zero field means
// "not set here": it is filled from common.
type Host struct {
	IP          string `yaml:"ip"`
	Port        int    `yaml:"port"`
	User        string `yaml:"user"`
	PasswordRef string `yaml:"password_ref"` // "${AULA_PASSWORD}", never a value

	// Password exists in the schema only so a literal password can be
	// reported as a PLAN error instead of being swallowed as an unknown key
	// (security.md §1.3). Nothing ever reads it as a credential.
	Password string `yaml:"password"`
}

// Student is one row of students:. Everything outside the known keys is a free
// field of the teacher's own (subdominio, p1, p3...) and is reachable only
// through substitution.
type Student struct {
	ID       string          `yaml:"id"`
	Name     string          `yaml:"name"`
	MoodleID string          `yaml:"moodle_id"`
	Excluded bool            `yaml:"excluded"`
	Hosts    map[string]Host `yaml:"hosts"`

	Fields map[string]string `yaml:"-"`

	// Line of the student's first key, for error messages about the student
	// as a whole.
	Line int `yaml:"-"`
}

// studentKnownKeys is the set the walker and UnmarshalYAML agree on.
var studentKnownKeys = map[string]bool{
	"id": true, "name": true, "moodle_id": true, "excluded": true, "hosts": true,
}

// UnmarshalYAML decodes the known keys and keeps every other scalar as a free
// field. Unknown keys are legal here and only here; checkKeys knows it.
func (s *Student) UnmarshalYAML(node *yaml.Node) error {
	if node.Kind != yaml.MappingNode {
		return errf(node.Line, "cada alumno debe ser un bloque de claves")
	}
	s.Line = node.Line
	s.Fields = map[string]string{}

	var errs []error
	seen := map[string]int{}
	for i := 0; i+1 < len(node.Content); i += 2 {
		key, val := node.Content[i], node.Content[i+1]
		if first, duplicate := seen[key.Value]; duplicate {
			errs = append(errs, errf(key.Line, "campo %q repetido: ya aparece en la línea %d", key.Value, first))
			continue
		}
		seen[key.Value] = key.Line
		// Former identity keys must not silently become teacher-defined data.
		if key.Value == "nombre" || key.Value == "excluido" {
			errs = append(errs, errf(key.Line, "clave desconocida %q: usa name o excluded en inglés", key.Value))
			continue
		}
		if !studentKnownKeys[key.Value] {
			if val.Kind != yaml.ScalarNode {
				errs = append(errs, errf(val.Line,
					"el campo libre %q del alumno debe ser un valor simple", key.Value))
				continue
			}
			s.Fields[key.Value] = val.Value
			continue
		}
		var target any
		switch key.Value {
		case "id":
			target = &s.ID
		case "name":
			target = &s.Name
		case "moodle_id":
			target = &s.MoodleID
		case "excluded":
			target = &s.Excluded
		case "hosts":
			target = &s.Hosts
		}
		if err := val.Decode(target); err != nil {
			errs = append(errs, decodeErr(key.Value, val, err))
		}
	}
	return join(errs)
}

// decodeErr keeps yaml.v3's Go type names out of the teacher's message: what
// the decoder says is replaced by the key and its line (T014).
func decodeErr(key string, node *yaml.Node, err error) error {
	var e *Error
	if errors.As(err, &e) {
		return err
	}
	return errf(node.Line, "valor inválido en %q", key)
}
