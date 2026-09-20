package plan

import (
	"fmt"
	"strings"
)

// scope is everything a ${...} reference may see: the student's own data and
// the logical hosts the exam declared. Nothing else is reachable, and secrets
// are not in it on purpose (security.md §1.4).
type scope struct {
	studentID string
	fields    map[string]string
	hosts     map[string]Host
}

// substitute replaces every ${...} of one string. The result is used as a
// whole argument or as a whole expected value and is never re-interpreted:
// spaces, quotes and ';' travel inside it and die there (rule 5 of §2).
func substitute(in string, sc scope) (string, error) {
	if !strings.Contains(in, "${") {
		return in, nil
	}
	var out strings.Builder
	rest := in
	for {
		start := strings.Index(rest, "${")
		if start < 0 {
			out.WriteString(rest)
			return out.String(), nil
		}
		out.WriteString(rest[:start])
		end := strings.Index(rest[start:], "}")
		if end < 0 {
			return "", fmt.Errorf("referencia sin cerrar en %q: falta la llave final", in)
		}
		ref := rest[start+2 : start+end]
		value, err := resolveRef(ref, sc)
		if err != nil {
			return "", err
		}
		out.WriteString(value)
		rest = rest[start+end+1:]
	}
}

func resolveRef(ref string, sc scope) (string, error) {
	if isSecretRef(ref) {
		return "", fmt.Errorf("${%s} es una referencia a un secreto y solo puede aparecer "+
			"en los campos de autenticación del aula, nunca en el examen", ref)
	}
	kind, name, ok := strings.Cut(ref, ".")
	if !ok || kind == "" || name == "" {
		return "", fmt.Errorf("referencia ${%s} inválida: se espera ${alumno.campo} o ${host.ip}", ref)
	}

	if kind == "alumno" {
		value, ok := sc.fields[name]
		if !ok {
			return "", fmt.Errorf("${alumno.%s}: el alumno %q no tiene el campo %q", name, sc.studentID, name)
		}
		return value, nil
	}

	host, ok := sc.hosts[kind]
	if !ok {
		return "", fmt.Errorf("${%s}: el host %q no está declarado en hosts: del examen", ref, kind)
	}
	switch name {
	case "ip":
		return host.IP, nil
	case "puerto":
		return fmt.Sprint(host.Port), nil
	case "usuario":
		return host.User, nil
	default:
		return "", fmt.Errorf("${%s}: de un host solo se puede usar ip, puerto o usuario", ref)
	}
}

// containsSecretRef reports whether a string carries a ${MAYUSCULAS}
// reference anywhere inside it.
func containsSecretRef(in string) bool {
	rest := in
	for {
		start := strings.Index(rest, "${")
		if start < 0 {
			return false
		}
		end := strings.Index(rest[start:], "}")
		if end < 0 {
			return false
		}
		if isSecretRef(rest[start+2 : start+end]) {
			return true
		}
		rest = rest[start+end+1:]
	}
}

// isSecretRef reports whether ref looks like ${AULA_PASSWORD}. Catching the
// shape, not a list of names, is what makes the guarantee structural: a
// secret that cannot enter a command cannot leave in a result.
func isSecretRef(ref string) bool {
	if ref == "" {
		return false
	}
	for i, r := range ref {
		switch {
		case r >= 'A' && r <= 'Z':
		case r == '_':
		case r >= '0' && r <= '9' && i > 0:
		default:
			return false
		}
	}
	return true
}
