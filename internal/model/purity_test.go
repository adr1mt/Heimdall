package model

import (
	"io/fs"

	"go/ast"
	"go/parser"
	"go/token"
	"strconv"
	"strings"
	"testing"
)

// forbiddenImports are the packages that would let a grade depend on the
// machine it was computed on. A dependency on any of them is what the rule
// "Classify and ComputeScore are pure functions" forbids.
var forbiddenImports = []string{
	"net", "net/http", "os", "os/exec", "io/ioutil", "math/rand", "syscall",
}

// forbiddenCalls are calls that read the outside world from packages that are
// legitimate as types. time is here for time.Time, not for reading the clock.
var forbiddenCalls = map[string]string{
	"time.Now":   "reads the clock",
	"time.Since": "reads the clock",
}

// TestScoringIsPure is the acceptance criterion that cannot be checked by
// example: the package must have no way to reach the network, the disk, the
// clock or the environment. If it could, the same artifact would grade
// differently on another machine, and the test that protects the grade would
// be protecting nothing.
func TestScoringIsPure(t *testing.T) {
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, ".", func(fi fs.FileInfo) bool {
		return !strings.HasSuffix(fi.Name(), "_test.go")
	}, 0)
	if err != nil {
		t.Fatalf("parse package: %v", err)
	}
	if len(pkgs) == 0 {
		t.Fatal("no non-test source parsed; the check would pass vacuously")
	}

	var files int
	for _, pkg := range pkgs {
		for name, file := range pkg.Files {
			files++

			for _, imp := range file.Imports {
				path, err := strconv.Unquote(imp.Path.Value)
				if err != nil {
					t.Fatalf("%s: bad import %s", name, imp.Path.Value)
				}
				for _, bad := range forbiddenImports {
					if path == bad {
						t.Errorf("%s imports %q; the grade must not depend on the machine", name, path)
					}
				}
			}

			ast.Inspect(file, func(n ast.Node) bool {
				call, ok := n.(*ast.CallExpr)
				if !ok {
					return true
				}
				sel, ok := call.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}
				ident, ok := sel.X.(*ast.Ident)
				if !ok {
					return true
				}
				qualified := ident.Name + "." + sel.Sel.Name
				if why, bad := forbiddenCalls[qualified]; bad {
					t.Errorf("%s calls %s, which %s", name, qualified, why)
				}
				return true
			})
		}
	}

	if files < 3 {
		t.Errorf("parsed %d source files, expected the whole package", files)
	}
}
