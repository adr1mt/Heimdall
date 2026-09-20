package main

import (
	"bytes"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"heimdall/internal/model"
	"heimdall/internal/plan"
)

// The three expressions the GUI applies to our output. They are copied from
// teuton-gui (main/teuton.ts:216 and renderer/lib/progress.ts); if any of them
// stops matching, the GUI stops seeing the engine.
var (
	guiVersion = regexp.MustCompile(`(?i)version\s+([\d.]+)`)
	guiTargets = regexp.MustCompile(`(?i)\|\s*Targets\s*\|\s*(\d+)\s*\|`)
)

func TestVersionMatchesTheExpressionOfTheGUI(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if got := run([]string{"version"}, &stdout, &stderr); got != exitOK {
		t.Fatalf("exit = %d (%s)", got, stderr.String())
	}
	m := guiVersion.FindStringSubmatch(stdout.String())
	if m == nil {
		t.Fatalf("salida %q: la GUI no la reconoce como un motor", stdout.String())
	}
	if m[1] != legacyVersion {
		t.Errorf("versión leída por la GUI = %q, se esperaba %q", m[1], legacyVersion)
	}
	if !strings.Contains(stdout.String(), version) {
		t.Errorf("salida %q: debe decir también qué motor es de verdad", stdout.String())
	}
}

// The number of targets the GUI reads is the number of checks of the PLAN, not
// an estimate: that is what makes its progress bar exact.
func TestCheckPublishesTheExactNumberOfTargets(t *testing.T) {
	p, err := plan.Load(protoProject)
	if err != nil {
		t.Fatalf("plan: %v", err)
	}

	var stdout, stderr bytes.Buffer
	if got := run([]string{"check", protoProject}, &stdout, &stderr); got != exitOK {
		t.Fatalf("exit = %d (%s)", got, stderr.String())
	}
	m := guiTargets.FindStringSubmatch(stdout.String())
	if m == nil {
		t.Fatalf("salida:\n%s\nno lleva la tabla que la GUI lee", stdout.String())
	}
	if m[1] != strconv.Itoa(p.Summary.CheckCount) {
		t.Errorf("Targets = %s, el PLAN tiene %d comprobaciones", m[1], p.Summary.CheckCount)
	}
}

// --cname picks another classroom file of the same project directory.
func TestCheckAcceptsCnameOfTheGUI(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if got := run([]string{"check", "--cname=aula", protoProject}, &stdout, &stderr); got != exitOK {
		t.Fatalf("exit = %d (%s)", got, stderr.String())
	}
	if !guiTargets.MatchString(stdout.String()) {
		t.Errorf("salida:\n%s\nno lleva la tabla que la GUI lee", stdout.String())
	}

	stdout.Reset()
	stderr.Reset()
	if got := run([]string{"check", "--cname=no-existe", protoProject}, &stdout, &stderr); got != exitInvalidConfig {
		t.Fatalf("un aula que no existe debe salir %d, salió %d", exitInvalidConfig, got)
	}
}

// C9: any other export format is an explicit error before anything runs, not a
// silent run whose files the GUI would then look for in vain.
func TestUnknownExportFails(t *testing.T) {
	var stdout, stderr bytes.Buffer
	got := run([]string{"run", "--export=xml", protoProject}, &stdout, &stderr)
	if got == exitOK {
		t.Fatalf("un --export desconocido no puede salir con 0")
	}
	if !strings.Contains(stderr.String(), "--export=xml") {
		t.Errorf("mensaje = %q: debe decir qué formato se pidió", stderr.String())
	}
	if stdout.Len() != 0 {
		t.Errorf("no debe imprimir nada por stdout: %q", stdout.String())
	}
}

func TestSelectCasesKeepsThePositionsAsked(t *testing.T) {
	p, err := plan.Load(protoProject)
	if err != nil {
		t.Fatalf("plan: %v", err)
	}
	all := len(p.Students)
	if all < 2 {
		t.Fatalf("el proyecto de prueba necesita al menos dos alumnos")
	}
	want := p.Students[all-1].ID
	weight := p.Summary.TotalWeight

	if err := selectCases(p, "2,2"); err != nil {
		t.Fatalf("selectCases: %v", err)
	}
	if len(p.Students) != 1 || p.Students[0].ID != want {
		t.Errorf("alumnos = %d, se esperaba solo %s", len(p.Students), want)
	}
	if p.Summary.TotalWeight != weight || p.Summary.CheckCount == 0 {
		t.Errorf("elegir alumnos no puede mover el denominador: %v", p.Summary)
	}

	for _, spec := range []string{"0", "99", "a", "1,x"} {
		p, _ := plan.Load(protoProject)
		if err := selectCases(p, spec); err == nil {
			t.Errorf("--case=%s debería ser un error de configuración", spec)
		}
	}
}

// The progress the GUI counts: one character per check between the two
// markers, and one single S for a student who was excluded. The count is
// reproduced here with the same semantics as lib/progress.ts.
func TestProgressCountsOneCharacterPerCheck(t *testing.T) {
	var out bytes.Buffer
	p := newProgress(&out)

	run := &model.RunResult{Students: []model.StudentResult{
		{},
		{StudentID: "alu2", Status: model.StudentExcluded},
	}}
	p.students(run)

	// alu1 finishes later than alu2 and fills the slot that was empty.
	run.Students[0] = model.StudentResult{StudentID: "alu1", Status: model.StudentOK, Checks: []model.CheckResult{
		{Status: model.Pass}, {Status: model.Fail}, {Status: model.Unevaluated},
	}}
	p.students(run)
	p.students(run) // a repeated partial must not count anybody twice
	p.finish()

	if got := countLikeTheGUI(out.String()); got != 4 {
		t.Errorf("la GUI contaría %d comprobaciones, se esperaban 4\nsalida: %q", got, out.String())
	}
	if !strings.Contains(out.String(), "Started at ") || !strings.Contains(out.String(), "Finished in ") {
		t.Errorf("salida %q: faltan las marcas entre las que la GUI cuenta", out.String())
	}
}

// countLikeTheGUI reproduces computeLiveProgress of teuton-gui.
func countLikeTheGUI(text string) int {
	start := strings.Index(text, "Started at")
	if start == -1 {
		return 0
	}
	nl := strings.Index(text[start:], "\n")
	if nl == -1 {
		return 0
	}
	region := text[start+nl+1:]
	if end := strings.Index(region, "Finished in"); end != -1 {
		region = region[:end]
	}
	return strings.Count(region, ".") + strings.Count(region, "F") + strings.Count(region, "S")
}

// A partial run is the ordinary exam: it must not look like a failure to the
// GUI, which throws away the reports of anything that does not end with 0.
// Everything else keeps its code.
func TestLegacyExitCodeOnlyForgivesThePartialRun(t *testing.T) {
	cases := map[int]int{
		exitOK:            exitOK,
		exitPartial:       exitOK,
		exitCancelled:     exitCancelled,
		exitInvalidConfig: exitInvalidConfig,
		exitFailure:       exitFailure,
	}
	for in, want := range cases {
		if got := legacyExitCode(in); got != want {
			t.Errorf("legacyExitCode(%d) = %d, se esperaba %d", in, got, want)
		}
	}
}
