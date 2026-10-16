//go:build integration

package ssh

import (
	"context"
	"strings"
	"testing"
	"time"
)

// The report lands in the home directory, whole, with 0644, and a second
// delivery of the same exam replaces the first (ADR-0031).
func TestWriteHomeLeavesAndReplacesTheReport(t *testing.T) {
	s := dialLab(t)
	ctx := context.Background()
	name := "informe-prueba-integracion.html"
	poison := "<p>\"; rm -rf ~; echo '$(id)' `whoami`</p>\n"

	if err := s.WriteHome(ctx, name, []byte("primero"), 30*time.Second); err != nil {
		t.Fatalf("primera escritura: %v", err)
	}
	if err := s.WriteHome(ctx, name, []byte(poison), 30*time.Second); err != nil {
		t.Fatalf("segunda escritura: %v", err)
	}
	res := s.Run(ctx, []string{"sh", "-c", `cd && stat -c %a "$1" && cat "$1" && ls -a | grep -c '^\.heimdall-' ; rm -f "$1"`, "x", name}, 20*time.Second)
	if !res.Completed {
		t.Fatalf("no se pudo leer el fichero: %+v", res)
	}
	want := "644\n" + poison + "0\n"
	if res.Stdout.Text != want {
		t.Errorf("en la máquina hay %q, se esperaba %q", res.Stdout.Text, want)
	}
}

// A directory with the report's name is left alone and the reason is said.
func TestWriteHomeLeavesADirectoryAlone(t *testing.T) {
	s := dialLab(t)
	ctx := context.Background()
	name := "informe-prueba-carpeta.html"
	s.Run(ctx, []string{"sh", "-c", `cd && mkdir -p "$1" && touch "$1/dentro"`, "x", name}, 20*time.Second)
	t.Cleanup(func() { s.Run(context.Background(), []string{"sh", "-c", `cd && rm -rf "$1"`, "x", name}, 20*time.Second) })

	err := s.WriteHome(ctx, name, []byte("x"), 30*time.Second)
	if err == nil || !strings.Contains(err.Error(), "carpeta llamada") {
		t.Fatalf("err = %v", err)
	}
	res := s.Run(ctx, []string{"sh", "-c", `cd && ls "$1"`, "x", name}, 20*time.Second)
	if strings.TrimSpace(res.Stdout.Text) != "dentro" {
		t.Errorf("la carpeta se tocó: %q", res.Stdout.Text)
	}
}
