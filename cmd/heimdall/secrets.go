package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"time"

	"heimdall/internal/plan"
)

// secretsSchema is the version of the one-line JSON document read from stdin.
const secretsSchema = 1

// stdinReadTimeout is how long --secrets=stdin waits for its line. A teacher
// who forgot to pipe anything must get an error, not a process hanging for
// ever in front of the class.
const stdinReadTimeout = 5 * time.Second

// maxSecretsLine caps the line read from stdin so a runaway pipe cannot grow
// the process without bound.
const maxSecretsLine = 64 << 10

// stdin is the source of --secrets=stdin. Tests replace it.
var stdin io.Reader = os.Stdin

// refPattern matches the ${MAYUSCULAS} form of a reference (ADR-0009).
var refPattern = regexp.MustCompile(`^\$\{([A-Z][A-Z0-9_]*)\}$`)

// readSecrets returns the secret values for the plan through the chosen
// channel. Neither channel is argv: a password in argv is readable by any user
// of the machine through ps (security rule 1).
func readSecrets(mode string, p *plan.Plan) (map[string]string, error) {
	switch mode {
	case "stdin":
		return secretsFromStdin()
	case "env":
		return secretsFromEnv(secretRefs(p))
	default:
		return nil, fmt.Errorf("--secrets=%s no existe: usa stdin o env", mode)
	}
}

// secretsFromStdin reads one JSON line, parses it and zeroes the bytes it
// read. The document is {"schema":1,"secrets":{"AULA_PASSWORD":"..."}}.
func secretsFromStdin() (map[string]string, error) {
	line, err := readLine(stdin)
	defer zero(line)
	if err != nil {
		return nil, err
	}

	var doc struct {
		Schema  int               `json:"schema"`
		Secrets map[string]string `json:"secrets"`
	}
	if err := json.Unmarshal(line, &doc); err != nil {
		return nil, fmt.Errorf("los secretos de stdin no son un JSON válido de una línea")
	}
	if doc.Schema != secretsSchema {
		return nil, fmt.Errorf("los secretos de stdin declaran schema %d, se esperaba %d", doc.Schema, secretsSchema)
	}
	// An empty map is a legitimate answer: a classroom whose machines need no
	// password asks for nothing. Whether what arrived covers what the PLAN
	// needs is decided in one place, engine.CheckSecrets, which names every
	// missing reference (security rule 7). Refusing an empty map here would
	// leave such a classroom impossible to correct from the GUI, which always
	// speaks through stdin.
	if doc.Secrets == nil {
		doc.Secrets = map[string]string{}
	}
	return doc.Secrets, nil
}

// readLine reads up to the first newline, byte by byte so no intermediate
// buffer keeps a copy of the secret we cannot zero. It gives up after
// stdinReadTimeout.
func readLine(r io.Reader) ([]byte, error) {
	type result struct {
		line []byte
		err  error
	}
	done := make(chan result, 1)
	go func() {
		line := make([]byte, 0, 256)
		b := make([]byte, 1)
		for {
			n, err := r.Read(b)
			if n == 1 {
				if b[0] == '\n' {
					break
				}
				line = append(line, b[0])
				if len(line) > maxSecretsLine {
					done <- result{nil, fmt.Errorf("los secretos de stdin pasan de %d bytes en una línea", maxSecretsLine)}
					return
				}
				continue
			}
			if err != nil {
				if err == io.EOF {
					break
				}
				done <- result{nil, fmt.Errorf("no se pudieron leer los secretos de stdin")}
				return
			}
		}
		if len(line) == 0 {
			done <- result{nil, fmt.Errorf("no llegó ningún secreto por stdin")}
			return
		}
		done <- result{line, nil}
	}()

	select {
	case res := <-done:
		return res.line, res.err
	case <-time.After(stdinReadTimeout):
		return nil, fmt.Errorf("no llegó ningún secreto por stdin en %s", stdinReadTimeout)
	}
}

// secretsFromEnv reads only the variables the inventory actually names. A
// reference without a variable is a PLAN error, never an empty password
// (security rule 7).
func secretsFromEnv(refs []string) (map[string]string, error) {
	secrets := make(map[string]string, len(refs))
	var missing []string
	for _, name := range refs {
		value, ok := os.LookupEnv(name)
		if !ok || value == "" {
			missing = append(missing, "la variable de entorno "+name+" que pide ${"+name+"} no está definida")
			continue
		}
		secrets[name] = value
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("%s", strings.Join(missing, "\n"))
	}
	return secrets, nil
}

// secretRefs lists the names referenced by the evaluable students of the plan,
// in order and without repeats.
func secretRefs(p *plan.Plan) []string {
	var names []string
	seen := map[string]bool{}
	for _, sp := range p.Students {
		if sp.Excluded {
			continue
		}
		for _, c := range sp.Checks {
			m := refPattern.FindStringSubmatch(c.Target.PasswordRef)
			if m == nil || seen[m[1]] {
				continue
			}
			seen[m[1]] = true
			names = append(names, m[1])
		}
	}
	return names
}

// zero overwrites a buffer that held a secret.
func zero(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

// values returns the secret values, which is what the writer needs to be able
// to recognise a leak in the artifact.
func values(secrets map[string]string) []string {
	out := make([]string, 0, len(secrets))
	for _, v := range secrets {
		out = append(out, v)
	}
	return out
}
