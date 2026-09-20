package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const protoProject = "../../testdata/proto"

// heimdall check must publish the exact number of checks and the exact total
// weight of the prototype (6, docs/design/07-PROTOTIPO.md §5) without opening
// a single connection. This is the number the GUI used to guess (c14-check).
func TestCheckPrintsThePlanOfTheValidProject(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if got := run([]string{"check", protoProject}, &stdout, &stderr); got != exitOK {
		t.Fatalf("exit = %d (%s)", got, stderr.String())
	}
	out := stdout.String()
	for _, want := range []string{"Comprobaciones: 5", "Peso total:     6", "Alumnos:        2 evaluables"} {
		if !strings.Contains(out, want) {
			t.Errorf("salida:\n%s\nfalta %q", out, want)
		}
	}
	if !strings.Contains(out, "Hash del plan:") {
		t.Errorf("salida:\n%s\nfalta el hash del plan", out)
	}
}

// An invalid project exits 2, says where the mistake is, and leaves nothing
// behind: no var/, no artifact, no machine contacted.
func TestCheckRejectsAndWritesNothing(t *testing.T) {
	before := varEntries(t)

	var stdout, stderr bytes.Buffer
	if got := run([]string{"check", "testdata/proyecto-invalido"}, &stdout, &stderr); got != exitInvalidConfig {
		t.Fatalf("exit = %d, se esperaba %d", got, exitInvalidConfig)
	}
	if stdout.Len() != 0 {
		t.Errorf("un proyecto inválido no debe imprimir nada por stdout: %q", stdout.String())
	}
	msg := stderr.String()
	if !strings.Contains(msg, "examen.yaml:7") || !strings.Contains(msg, "le falta la aserción") {
		t.Errorf("mensaje = %q: debe decir el fichero, la línea y el motivo", msg)
	}
	if strings.Contains(msg, "goroutine") || strings.Contains(msg, ".go:") {
		t.Errorf("mensaje = %q: no puede llevar traza de pila", msg)
	}

	if after := varEntries(t); after != before {
		t.Errorf("var/ cambió: %d entradas antes, %d después", before, after)
	}
}

// varEntries counts what lives in the repository's var/ directory.
func varEntries(t *testing.T) int {
	t.Helper()
	entries, err := os.ReadDir(filepath.Join("..", "..", "var"))
	if os.IsNotExist(err) {
		return 0
	}
	if err != nil {
		t.Fatalf("leyendo var/: %v", err)
	}
	return len(entries)
}
