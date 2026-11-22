// Package probe resolves teacher-installed checkers before any SSH connection.
package probe

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
)

var profileName = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)
var revisionID = regexp.MustCompile(`^[0-9a-f]{64}$`)

type profile struct {
	Arguments int      `json:"arguments"`
	Criteria  []string `json:"criteria"`
	source    string
}

// Registry is scoped to one plan. Each revision is read once and its verified
// bytes stay with that plan throughout execution.
type Registry map[string]*profile

func (r Registry) Resolve(args []string) (string, error) {
	if len(args) < 3 || !profileName.MatchString(args[0]) || !revisionID.MatchString(args[1]) {
		return "", fmt.Errorf("checker requiere un perfil, una revisión SHA-256 y un criterio")
	}
	key := filepath.Join(args[0], args[1])
	p := r[key]
	if p == nil {
		var err error
		p, err = loadProfile(key, args[1])
		if err != nil {
			return "", err
		}
		r[key] = p
	}
	if len(args)-3 != p.Arguments || !slices.Contains(p.Criteria, args[2]) {
		return "", fmt.Errorf("criterio o número de argumentos inválido para el perfil %s", args[0])
	}
	for _, v := range args[3:] {
		if v == "" {
			return "", fmt.Errorf("checker: argumento vacío")
		}
	}
	return p.source, nil
}

func loadProfile(key, revision string) (*profile, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	// Only explicitly installed profiles can be selected by a portable exam.
	root, err := os.OpenRoot(filepath.Join(dir, "heimdall", "checkers"))
	if err != nil {
		return nil, fmt.Errorf("no se puede abrir el directorio de comprobadores instalados: %w", err)
	}
	defer root.Close()
	spec, err := root.ReadFile(filepath.Join(key, "criteria.json"))
	if err != nil {
		return nil, fmt.Errorf("no se puede leer el perfil instalado %s: %w", key, err)
	}
	p := &profile{Arguments: -1}
	if err := json.Unmarshal(spec, p); err != nil || p.Arguments < 0 || len(p.Criteria) == 0 {
		return nil, fmt.Errorf("descripción inválida del perfil %s", key)
	}
	source, err := root.ReadFile(filepath.Join(key, "checker.py"))
	if err != nil {
		return nil, fmt.Errorf("no se puede leer el comprobador %s: %w", key, err)
	}
	if fmt.Sprintf("%x", sha256.Sum256(source)) != revision {
		return nil, fmt.Errorf("el contenido del comprobador %s no coincide con su revisión", key)
	}
	p.source = string(source)
	return p, nil
}
