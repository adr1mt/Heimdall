// Package probe owns the fixed, versioned RA1 checker (ADR-0036). It never
// executes locally. The only remote program is embedded at build time; the
// declarative exam supplies a known criterion and three literal arguments.
package probe

import (
	"crypto/sha256"
	_ "embed"
	"fmt"
)

//go:embed ra1.py
var source string

func Revision() string { return fmt.Sprintf("%x", sha256.Sum256([]byte(source))) }

var criteria = map[string]bool{}

func init() {
	for _, id := range []string{
		"net-externa-ip", "net-externa-estatica", "net-externa-netplan", "net-externa-gw", "net-externa-dns",
		"net-interna-ip", "net-interna-netplan", "net-interna-sense-gw", "net-sortida", "net-resolucio",
		"kea-interficie", "kea-subxarxa", "kea-rang-inici", "kea-rang-final", "kea-porta-enllac", "kea-dns",
		"kea-reserva-mail", "kea-reserva-web", "kea-reserva-impressora1", "kea-reserva-impressora2", "kea-actiu",
		"kea-reserves",
		"fwd-actiu", "fwd-persistent", "nft-anada", "nft-retorn", "nft-masquerade", "nft-carregat-masquerade",
		"nft-carregat-anada", "nft-actiu", "nft-habilitat", "client-concessio",
	} {
		criteria[id] = true
	}
}

func Validate(args []string) error {
	if len(args) != 6 || args[0] != "ra1-dhcp" {
		return fmt.Errorf("comprobador: se esperan [ra1-dhcp, revisión, criterio, interfaz externa, interfaz interna, IP de examen]")
	}
	if args[1] != Revision() {
		return fmt.Errorf("comprobador: esta revisión requiere otra compilación de Heimdall; no se ejecutará ni calificará")
	}
	if !criteria[args[2]] {
		return fmt.Errorf("comprobador: criterio desconocido %q", args[2])
	}
	for _, arg := range args[3:] {
		if arg == "" {
			return fmt.Errorf("comprobador: faltan datos de interfaces o IP")
		}
	}
	return nil
}

// Command is called only after full PLAN validation and substitution. -I
// prevents student-controlled Python modules, PYTHONPATH and user site hooks.
func Command(args []string) []string {
	return append([]string{"python3", "-I", "-c", source}, args[2:]...)
}
