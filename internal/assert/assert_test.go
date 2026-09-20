package assert

import (
	"errors"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"strings"
	"testing"

	"heimdall/internal/model"
)

// completed builds an execution that finished, with the given stdout.
func completed(stdout string, code int) model.ExecutionResult {
	return model.ExecutionResult{
		Completed: true,
		ExitCode:  &code,
		Stdout:    model.Stream{Text: stdout, Bytes: int64(len(stdout)), BytesTotal: int64(len(stdout))},
	}
}

func TestContains(t *testing.T) {
	cases := []struct {
		name     string
		stdout   string
		expected string
		matched  bool
		where    string
	}{
		{"primera línea", "10.0.0.1/8\n", "10.0.0.1/8", true, "stdout línea 1"},
		{"tercera línea", "uno\ndos\n10.0.0.1/8\n", "10.0.0.1/8", true, "stdout línea 3"},
		{"a mitad de línea", "inet 10.0.0.1/8 scope\n", "10.0.0.1/8", true, "stdout línea 1"},
		{"ausente", "uno\ndos\n", "tres", false, ""},
		{"multilínea esperada", "a\nb\nc\n", "b\nc", true, "stdout línea 2"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := Eval(completed(c.stdout, 0), Spec{Kind: KindContains, Expected: c.expected})
			if err != nil {
				t.Fatalf("Eval: %v", err)
			}
			if got.Matched != c.matched {
				t.Errorf("matched = %v, se esperaba %v", got.Matched, c.matched)
			}
			if got.Where != c.where {
				t.Errorf("where = %q, se esperaba %q", got.Where, c.where)
			}
			if c.matched && got.Found != c.expected {
				t.Errorf("found = %q, se esperaba %q", got.Found, c.expected)
			}
			if !c.matched && got.Found != "" {
				t.Errorf("found = %q, se esperaba vacío", got.Found)
			}
			if got.Kind != "contains" {
				t.Errorf("kind = %q", got.Kind)
			}
		})
	}
}

func TestEquals(t *testing.T) {
	cases := []struct {
		name     string
		stdout   string
		expected string
		matched  bool
	}{
		{"exacto", "active", "active", true},
		{"salto final", "active\n", "active", true},
		{"espacios alrededor", "  active \n\n", "active", true},
		{"espacios internos no se ignoran", "a  b", "a b", false},
		{"subcadena no basta", "active (running)", "active", false},
		{"distinto", "inactive\n", "active", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := Eval(completed(c.stdout, 0), Spec{Kind: KindEquals, Expected: c.expected})
			if err != nil {
				t.Fatalf("Eval: %v", err)
			}
			if got.Matched != c.matched {
				t.Fatalf("matched = %v, se esperaba %v (stdout %q)", got.Matched, c.matched, c.stdout)
			}
			if !c.matched && got.Found != "" {
				t.Errorf("found = %q, se esperaba vacío", got.Found)
			}
			if c.matched && got.Found != strings.TrimSpace(c.stdout) {
				t.Errorf("found = %q", got.Found)
			}
		})
	}
}

func TestExitCode(t *testing.T) {
	for _, c := range []struct {
		got, want int
		matched   bool
	}{{0, 0, true}, {1, 0, false}, {127, 0, false}, {127, 127, true}} {
		res, err := Eval(completed("", c.got), Spec{Kind: KindExitCode, ExitCode: c.want})
		if err != nil {
			t.Fatalf("Eval: %v", err)
		}
		if res.Matched != c.matched {
			t.Errorf("exit %d contra %d: matched = %v", c.got, c.want, res.Matched)
		}
		if res.Found == "" {
			t.Errorf("exit %d: found vacío", c.got)
		}
	}
}

// TestEvalRefusesIncompleteExecution is the acceptance criterion that the
// assertion layer cannot be reached without a trustworthy execution: an
// unfinished command must never produce a comparison, and therefore can never
// produce a FAIL.
func TestEvalRefusesIncompleteExecution(t *testing.T) {
	exec := model.ExecutionResult{Completed: false, Stdout: model.Stream{Text: "active"}}
	for _, spec := range []Spec{
		{Kind: KindContains, Expected: "active"},
		{Kind: KindEquals, Expected: "active"},
		{Kind: KindExitCode, ExitCode: 0},
	} {
		got, err := Eval(exec, spec)
		if !errors.Is(err, ErrNotCompleted) {
			t.Fatalf("%s: err = %v, se esperaba ErrNotCompleted", spec.Kind, err)
		}
		if got != (model.AssertionResult{}) {
			t.Errorf("%s: se devolvió un resultado %+v", spec.Kind, got)
		}
	}
}

func TestUnknownKindIsAnError(t *testing.T) {
	_, err := Eval(completed("x", 0), Spec{Kind: "cerca_de", Expected: "x"})
	if !errors.Is(err, ErrUnknownKind) {
		t.Fatalf("err = %v, se esperaba ErrUnknownKind", err)
	}
}

// TestEvalNeverReturnsAnAcademicStatus guards the layer boundary by
// construction: the package must not even mention the academic enums.
func TestEvalNeverReturnsAnAcademicStatus(t *testing.T) {
	forbidden := []string{"net", "os", "time", "os/exec", "math/rand"}
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, ".", func(fi fs.FileInfo) bool {
		return !strings.HasSuffix(fi.Name(), "_test.go")
	}, 0)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(pkgs) == 0 {
		t.Fatal("no se parseó ningún fichero: la comprobación pasaría en vacío")
	}
	for _, pkg := range pkgs {
		for name, file := range pkg.Files {
			for _, imp := range file.Imports {
				path := strings.Trim(imp.Path.Value, `"`)
				for _, f := range forbidden {
					if path == f {
						t.Errorf("%s importa %q", name, path)
					}
				}
			}
			for _, bad := range []string{"AcademicStatus", "Classify", "model.Pass", "model.Fail", "Unevaluated"} {
				if strings.Contains(sourceOf(t, name), bad) {
					t.Errorf("%s menciona %s: la capa de aserciones no decide estados académicos", name, bad)
				}
			}
		}
	}
}

func sourceOf(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("leer %s: %v", path, err)
	}
	return string(b)
}
