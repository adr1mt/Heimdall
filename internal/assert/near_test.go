package assert

import (
	"errors"
	"strings"
	"testing"
)

// keaConf is the shape of the file the real exam greps: an anchor line and
// the value a few lines below it.
const keaConf = `{
"Dhcp4": {
    "subnet4": [
        { "subnet": "10.0.0.0/8",
          "pools": [ { "pool": "10.0.0.100 - 10.0.0.200" } ],
          "option-data": []
        }
    ]
}
}`

func TestNotContains(t *testing.T) {
	cases := []struct {
		name      string
		stdout    string
		forbidden string
		matched   bool
		where     string
	}{
		{"ausente, que es lo que se pide", "allow-recursion { 10.0.0.0/8; };\n", "allow-recursion { any; }", true, ""},
		{"presente en la primera línea", "allow-recursion { any; };\n", "allow-recursion { any; }", false, "stdout línea 1"},
		{"presente más abajo", "options {\n  forwarders { 9.9.9.9; };\n  allow-recursion { any; };\n}\n", "allow-recursion { any; }", false, "stdout línea 3"},
		{"salida vacía de un comando que sí terminó", "", "allow-recursion { any; }", true, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := Eval(completed(c.stdout, 0), Spec{Kind: KindNotContains, Expected: c.forbidden})
			if err != nil {
				t.Fatalf("Eval: %v", err)
			}
			if got.Matched != c.matched {
				t.Errorf("matched = %v, se esperaba %v", got.Matched, c.matched)
			}
			if got.Where != c.where {
				t.Errorf("where = %q, se esperaba %q", got.Where, c.where)
			}
			if got.Kind != "not_contains" {
				t.Errorf("kind = %q", got.Kind)
			}
			if got.Expected != c.forbidden {
				t.Errorf("expected = %q", got.Expected)
			}
		})
	}
}

// TestNotContainsNeedsACompleteExecution is K-7: an anti-check passes by
// absence, so a machine that never answered would pass every one of them.
// The only defence is that there is no assertion at all without a complete
// execution, and that defence has to hold for this kind above all.
func TestNotContainsNeedsACompleteExecution(t *testing.T) {
	exec := completed("", 0)
	exec.Completed = false

	_, err := Eval(exec, Spec{Kind: KindNotContains, Expected: "allow-recursion { any; }"})
	if !errors.Is(err, ErrNotCompleted) {
		t.Fatalf("una anticomprobación sin ejecución completa devolvió %v, se esperaba ErrNotCompleted", err)
	}
}

func TestNear(t *testing.T) {
	cases := []struct {
		name     string
		stdout   string
		anchor   string
		lines    int
		expected string
		matched  bool
	}{
		{"en la misma línea del ancla", keaConf, `"subnet"`, 5, "10.0.0.0/8", true},
		{"dentro de la ventana", keaConf, `"subnet4"`, 5, "10.0.0.200", true},
		{"fuera de la ventana", keaConf, `"Dhcp4"`, 1, "10.0.0.200", false},
		{"justo en el borde de la ventana", keaConf, `"Dhcp4"`, 3, "10.0.0.200", true},
		{"ventana de cero líneas, solo el ancla", keaConf, `"subnet4"`, 0, "10.0.0.200", false},
		{"el ancla no aparece", keaConf, "forwarders", 5, "10.0.0.0/8", false},
		{"el valor no aparece en ningún sitio", keaConf, `"subnet"`, 5, "192.168.1.0/24", false},
		{"la ventana se sale del final del fichero", "uno\ndos\n", "uno", 99, "dos", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			spec := Spec{Kind: KindNear, Expected: c.expected, Anchor: c.anchor, Lines: c.lines}
			got, err := Eval(completed(c.stdout, 0), spec)
			if err != nil {
				t.Fatalf("Eval: %v", err)
			}
			if got.Matched != c.matched {
				t.Errorf("matched = %v, se esperaba %v (where = %q)", got.Matched, c.matched, got.Where)
			}
			if got.Kind != "near" {
				t.Errorf("kind = %q", got.Kind)
			}
			// The teacher must be able to read what was demanded without
			// going back to the exam, and without escaped quotes.
			if strings.Contains(got.Expected, `\"`) {
				t.Errorf("expected = %q, trae comillas escapadas", got.Expected)
			}
			for _, part := range []string{c.expected, c.anchor} {
				if !strings.Contains(got.Expected, part) {
					t.Errorf("expected = %q, no menciona %q", got.Expected, part)
				}
			}
		})
	}
}

// TestNearRetriesEveryAnchor: a configuration file repeats its anchor, and
// the value may hang from the second one. Stopping at the first would fail a
// student who did it right.
func TestNearRetriesEveryAnchor(t *testing.T) {
	stdout := "subnet A\n  nada\nsubnet B\n  10.0.0.0/8\n"
	got, err := Eval(completed(stdout, 0), Spec{
		Kind: KindNear, Anchor: "subnet", Lines: 1, Expected: "10.0.0.0/8",
	})
	if err != nil {
		t.Fatalf("Eval: %v", err)
	}
	if !got.Matched {
		t.Fatalf("no encontró el valor bajo la segunda aparición del ancla")
	}
	if got.Where != "stdout línea 4, con el ancla en la línea 3" {
		t.Errorf("where = %q", got.Where)
	}
}

// TestNearNeedsACompleteExecution: same reasoning as K-7. An anchor that
// never arrived is not an anchor that is missing.
func TestNearNeedsACompleteExecution(t *testing.T) {
	exec := completed("", 0)
	exec.Completed = false

	_, err := Eval(exec, Spec{Kind: KindNear, Anchor: "subnet", Lines: 5, Expected: "10.0.0.0/8"})
	if !errors.Is(err, ErrNotCompleted) {
		t.Fatalf("devolvió %v, se esperaba ErrNotCompleted", err)
	}
}
