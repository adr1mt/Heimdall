// Command heimdall evaluates systems-and-networking lab work over SSH.
//
// Subcommands: run, check, version.
package main

import (
	"fmt"
	"io"
	"os"
)

// version is the engine version. The product name is provisional (D-7).
const version = "0.1.0-dev"

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
		printVersion(stdout)
		return exitOK
	case "run":
		return runCmd(args[1:], stdout, stderr)
	case "check":
		return checkCmd(args[1:], stdout, stderr)
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
  version              imprime la version del motor
`)
}
