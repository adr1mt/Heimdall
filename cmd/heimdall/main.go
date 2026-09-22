// Command heimdall evaluates systems-and-networking lab work over SSH.
//
// Subcommands: run, check, consolidate, session, version.
package main

import (
	"fmt"
	"io"
	"os"
)

// version is the engine version. `make build` stamps it from the VERSION file
// at the root, the single place the number is written; a build by hand says
// "dev" and that is the point: only a packaged engine claims a version.
var version = "dev"

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

// run holds the whole CLI so it can be exercised from tests without exiting.
func run(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		usage(stderr)
		return exitInvalidConfig
	}

	switch args[0] {
	case "version":
		fmt.Fprintf(stdout, "heimdall %s\n", version)
		return exitOK
	case "run":
		return runCmd(args[1:], stdout, stderr)
	case "check":
		return checkCmd(args[1:], stdout, stderr)
	case "consolidate":
		return consolidateCmd(args[1:], stdout, stderr)
	case "session":
		return sessionCmd(args[1:], stdout, stderr)
	default:
		fmt.Fprintf(stderr, "heimdall: subcomando desconocido %q\n", args[0])
		usage(stderr)
		return exitInvalidConfig
	}
}

func usage(w io.Writer) {
	fmt.Fprint(w, `uso: heimdall <subcomando>

  run                  evalua un examen contra el aula
  check <directorio>   resuelve el PLAN sin tocar ninguna maquina
  consolidate <fich>   lee una cadena de correcciones como una sola
  session <fich...>    lee las vueltas de una sesion de examen como una sola
  version              imprime la version del motor
`)
}
