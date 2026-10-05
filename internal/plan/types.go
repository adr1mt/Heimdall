// Package plan reads the two declarative files the teacher writes,
// examen.yaml and aula.yaml, and turns them into Go values.
//
// The YAML keys are Spanish because the teacher reads and writes them; the Go
// field names are English like the rest of the engine. See
// docs/design/02-FORMATO.md.
//
// This package only parses. The nine semantic validations of the PLAN, the
// ${...} substitution and the hashes belong to the PLAN resolution (T005), and
// evaluating an assertion belongs to internal/assert.
package plan

import (
	"errors"
	"time"

	"gopkg.in/yaml.v3"
)

// Defaults used when the exam does not set por_defecto. Both are explicit
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
	Name     string   `yaml:"examen"`
	Version  int      `yaml:"version"`
	Hosts    []string `yaml:"hosts"`
	Defaults Defaults `yaml:"por_defecto"`
	Groups   []Group  `yaml:"grupos"`
}

// Defaults is por_defecto: the values a check inherits when it says nothing.
type Defaults struct {
	Weight  *float64  `yaml:"peso"`
	Timeout *Duration `yaml:"timeout"`
}

// Group is a titled block of checks. The GUI shows the title (M-3).
type Group struct {
	Name   string  `yaml:"grupo"`
	Checks []Check `yaml:"comprobaciones"`
}

// Check is one check. Weight and Timeout are resolved against por_defecto at
// load time, so they are never nil once LoadExam returns.
type Check struct {
	ID          string    `yaml:"id"`
	Description string    `yaml:"descripcion"`
	On          string    `yaml:"en"` // logical host, empty for a valor: check
	Weight      *float64  `yaml:"peso"`
	Timeout     *Duration `yaml:"timeout"`

	File  *string  `yaml:"fichero"` // explicit shared content source
	Cmd   []string `yaml:"cmd"`     // argument vector, never a shell string
	Value string   `yaml:"valor"`   // check without a command (M-11)

	// Assertions. A pointer distinguishes "absent" from "expects the empty
	// string"; a check with none or with two incompatible ones is a PLAN
	// error, detected in T005.
	Contains    *string   `yaml:"contiene"`
	NotContains *string   `yaml:"no_contiene"`
	Equals      *string   `yaml:"igual_a"`
	ExitCode    *int      `yaml:"exit_code"`
	Near        *NearSpec `yaml:"cerca_de"`

	// Line of the check in examen.yaml, for the PLAN error messages.
	Line           int `yaml:"-"`
	commandPresent bool
	valuePresent   bool
}

// NearSpec is cerca_de: what grep -A N used to do (M-10).
type NearSpec struct {
	Anchor   string `yaml:"ancla"`
	Lines    int    `yaml:"lineas"`
	Contains string `yaml:"contiene"`
}

// Inventory is aula.yaml.
type Inventory struct {
	Name     string    `yaml:"aula"`
	Version  int       `yaml:"version"`
	Common   Common    `yaml:"comun"`
	Students []Student `yaml:"alumnos"`
}

// Common is comun: what every student's hosts inherit.
type Common struct {
	Hosts    map[string]Host `yaml:"hosts"`
	Timeouts Timeouts        `yaml:"timeouts"`
}

// Timeouts are the run-wide budgets.
type Timeouts struct {
	Connect *Duration `yaml:"conexion"`
	Student *Duration `yaml:"alumno"`
}

// Host is where one logical host of one student lives. A zero field means
// "not set here": it is filled from comun.
type Host struct {
	IP          string `yaml:"ip"`
	Port        int    `yaml:"puerto"`
	User        string `yaml:"usuario"`
	PasswordRef string `yaml:"password_ref"` // "${AULA_PASSWORD}", never a value

	// Password exists in the schema only so a literal password can be
	// reported as a PLAN error instead of being swallowed as an unknown key
	// (security.md §1.3). Nothing ever reads it as a credential.
	Password string `yaml:"password"`
}

// Student is one row of alumnos:. Everything outside the known keys is a free
// field of the teacher's own (subdominio, p1, p3...) and is reachable only
// through substitution.
type Student struct {
	ID       string          `yaml:"id"`
	Name     string          `yaml:"nombre"`
	MoodleID string          `yaml:"moodle_id"`
	Excluded bool            `yaml:"excluido"`
	Hosts    map[string]Host `yaml:"hosts"`

	Fields map[string]string `yaml:"-"`

	// Line of the student's first key, for error messages about the student
	// as a whole.
	Line int `yaml:"-"`
}

// studentKnownKeys is the set the walker and UnmarshalYAML agree on.
var studentKnownKeys = map[string]bool{
	"id": true, "nombre": true, "moodle_id": true, "excluido": true, "hosts": true,
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
		case "nombre":
			target = &s.Name
		case "moodle_id":
			target = &s.MoodleID
		case "excluido":
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
