package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os/signal"
	"path/filepath"
	"syscall"

	"heimdall/internal/engine"
	"heimdall/internal/events"
	"heimdall/internal/legacy"
	"heimdall/internal/model"
	"heimdall/internal/plan"
	"heimdall/internal/report"
)

// runCmd evaluates a project against the classroom and writes the artifact.
//
// The order matters: the PLAN is resolved and the secrets are checked before
// the first connection, so a configuration mistake ends with exit 2 and an
// untouched var/, and never with a class full of UNEVALUATED checks.
func runCmd(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("run", flag.ContinueOnError)
	fs.SetOutput(stderr)
	secretsMode := fs.String("secrets", "env", "canal de los secretos: stdin o env")
	varDir := fs.String("var", "var", "directorio donde se escribe el artefacto")
	concurrency := fs.Int("concurrency", 0, "alumnos en paralelo; 0 usa el del examen")
	hostConcurrency := fs.Int("host-concurrency", 0, "conexiones que se abren a la vez contra una misma máquina; 0 usa el del examen")
	compat := fs.String("compat", "", "escribe además los ficheros del formato antiguo: teuton2")
	eventStream := fs.String("events", "", "emite el contrato nativo por stdout mientras corre: ndjson")
	export := fs.String("export", "", "fachada para la GUI actual: json")
	cname := fs.String("cname", "", "nombre del fichero de aula, sin la extensión; por defecto aula.yaml")
	cases := fs.String("case", "", "posiciones de los alumnos del aula que se evalúan, p. ej. 1,3")
	if err := fs.Parse(args); err != nil {
		return exitInvalidConfig
	}
	if fs.NArg() != 1 {
		fmt.Fprintln(stderr, "uso: heimdall run [--secrets=stdin|env] [--var=dir] [--events=ndjson] <directorio del examen>")
		return exitInvalidConfig
	}
	if *eventStream != "" && *eventStream != "ndjson" {
		fmt.Fprintf(stderr, "heimdall run: --events=%s no existe; el contrato nativo es ndjson\n", *eventStream)
		return exitInvalidConfig
	}
	if *eventStream != "" && *export != "" {
		fmt.Fprintln(stderr, "heimdall run: --events y --export escriben los dos en stdout; usa solo uno")
		return exitInvalidConfig
	}
	if *compat != "" && *compat != "teuton2" {
		fmt.Fprintf(stderr, "heimdall run: --compat=%s no existe; el único formato antiguo soportado es teuton2\n", *compat)
		return exitInvalidConfig
	}
	// --export=json is how the GUI asks for a run: it wants the old files and
	// the live progress. Any other format would end with the GUI reading a
	// directory that nobody wrote, so it is an error here and not a surprise
	// there (C9).
	if *export != "" {
		if *export != "json" {
			fmt.Fprintf(stderr, "heimdall run: --export=%s no existe; este motor solo exporta json\n", *export)
			return exitInvalidConfig
		}
		*compat = "teuton2"
	}

	p, err := plan.LoadNamed(fs.Arg(0), *cname)
	if err != nil {
		fmt.Fprintf(stderr, "heimdall run: la configuración no es válida\n\n%s\n", err)
		return exitInvalidConfig
	}
	if err := selectCases(p, *cases); err != nil {
		fmt.Fprintf(stderr, "heimdall run: %s\n", err)
		return exitInvalidConfig
	}

	secrets, err := readSecrets(*secretsMode, p)
	if err != nil {
		fmt.Fprintf(stderr, "heimdall run: %s\n", err)
		return exitInvalidConfig
	}
	defer func() {
		for k := range secrets {
			delete(secrets, k)
		}
	}()

	if err := engine.CheckSecrets(p, secrets); err != nil {
		fmt.Fprintf(stderr, "heimdall run: faltan credenciales\n\n%s\n", err)
		return exitInvalidConfig
	}

	runID, err := report.NewRunID()
	if err != nil {
		fmt.Fprintf(stderr, "heimdall run: no se pudo generar el identificador de la ejecución: %s\n", err)
		return exitFailure
	}
	writer, err := report.New(*varDir, runID, values(secrets))
	if err != nil {
		fmt.Fprintf(stderr, "heimdall run: %s\n", err)
		return exitFailure
	}

	// Ctrl-C cancels the run; it does not kill the artifact. The second signal
	// is the operating system's business, not ours.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	var live *progress
	if *export == "json" {
		live = newProgress(stdout)
	}

	// The native stream owns stdout while it is on: a line of prose in the
	// middle of it would break the only channel the GUI has.
	var stream *events.Emitter
	if *eventStream == "ndjson" {
		stream = events.New(stdout, values(secrets))
		stream.RunStart(runStartOf(runID, p))
	}

	var partialErr error
	result := engine.Run(ctx, p, engine.Options{
		RunID:           runID,
		EngineVersion:   version,
		Secrets:         secrets,
		Concurrency:     *concurrency,
		HostConcurrency: *hostConcurrency,
		Progress:        progressTo(stream),
		OnStudentDone: func(run *model.RunResult) error {
			if live != nil {
				live.students(run)
			}
			if err := writer.WritePartial(run); err != nil {
				partialErr = err
				return err
			}
			return nil
		},
	})

	if live != nil {
		live.students(result)
		live.finish()
	}

	path, err := writer.WriteFinal(result)
	if err != nil {
		fmt.Fprintf(stderr, "heimdall run: no se pudo escribir el artefacto: %s\n", err)
		if stream != nil {
			stream.RunEnd(runEndOf(result, "", exitFailure))
		}
		return exitFailure
	}
	if partialErr != nil {
		fmt.Fprintf(stderr, "heimdall run: aviso: no se pudo guardar algún parcial: %s\n", partialErr)
	}

	if *compat == "teuton2" {
		if err := writeLegacy(*varDir, fs.Arg(0), result, values(secrets)); err != nil {
			fmt.Fprintf(stderr, "heimdall run: aviso: %s\n", err)
		}
	}

	code := engine.ExitCode(result)
	if *export == "json" {
		code = legacyExitCode(code)
	}

	if stream != nil {
		stream.RunEnd(runEndOf(result, path, code))
		if err := stream.Err(); err != nil {
			fmt.Fprintf(stderr, "heimdall run: aviso: %s\n", err)
		}
	} else {
		printSummary(stdout, result, path)
	}
	return code
}

// progressTo wires the engine's live report to the event stream. Without a
// stream there is nothing to report and the engine is told so, which keeps
// the run free of callbacks nobody reads.
func progressTo(stream *events.Emitter) *engine.Progress {
	if stream == nil {
		return nil
	}
	return &engine.Progress{
		StudentStart: func(studentID, name string) {
			stream.StudentStart(events.StudentStart{StudentID: studentID, Name: name})
		},
		CheckDone: func(studentID string, c model.CheckResult) {
			stream.CheckEnd(events.CheckEndOf(studentID, c))
		},
		StudentEnd: func(result model.StudentResult) {
			stream.StudentEnd(events.StudentEnd{
				StudentID: result.StudentID,
				Status:    result.Status,
				Score:     result.Score,
			})
		},
	}
}

// runStartOf describes the run before it touches a machine. Everything here
// comes from the PLAN, which is already fixed and will not move (ADR-0002).
func runStartOf(runID string, p *plan.Plan) events.RunStart {
	students := make([]events.StudentRef, 0, len(p.Students))
	evaluable := 0
	for _, sp := range p.Students {
		students = append(students, events.StudentRef{
			StudentID: sp.ID,
			Name:      sp.Name,
			MoodleID:  sp.MoodleID,
			Excluded:  sp.Excluded,
		})
		if !sp.Excluded {
			evaluable++
		}
	}
	return events.RunStart{
		RunID:          runID,
		EngineVersion:  version,
		Exam:           p.Exam,
		Inventory:      p.Inventory,
		PlanHash:       p.Hash,
		Plan:           p.Summary,
		ExpectedChecks: evaluable * p.Summary.CheckCount,
		Students:       students,
	}
}

// runEndOf closes the stream with the same status and the same exit code the
// process is about to use, and points at the artifact, which is where the
// result really lives.
func runEndOf(run *model.RunResult, artifact string, code int) events.RunEnd {
	return events.RunEnd{
		Status:   run.Status,
		ExitCode: code,
		Artifact: artifact,
		Counts:   events.CountsOf(run),
		Warnings: run.Warnings,
	}
}

// writeLegacy writes the files the current GUI reads, on top of the canonical
// artifact, which is always written. The test name is the name of the project
// directory, which is where the GUI looks when the project has no tt_testname
// (C5). A failure here is a warning, never a different exit code: the run and
// its grades already happened.
func writeLegacy(varDir, projectDir string, run *model.RunResult, secrets []string) error {
	clean, err := report.Redact(run, secrets)
	if err != nil {
		return fmt.Errorf("no se pudieron escribir los ficheros del formato antiguo: %w", err)
	}
	abs, err := filepath.Abs(projectDir)
	if err != nil {
		return fmt.Errorf("no se pudo resolver %s: %w", projectDir, err)
	}
	w, err := legacy.New(varDir, filepath.Base(abs))
	if err != nil {
		return err
	}
	return w.Write(clean)
}

// printSummary tells the teacher what happened in the words of the classroom:
// who could be evaluated, who could not and where the evidence is.
func printSummary(w io.Writer, run *model.RunResult, path string) {
	fmt.Fprintf(w, "Examen:   %s\n", run.Exam.Path)
	fmt.Fprintf(w, "Aula:     %s\n", run.Inventory.Path)
	fmt.Fprintf(w, "Estado:   %s\n\n", run.Status)
	for _, s := range run.Students {
		fmt.Fprintf(w, "  %-12s %-14s %s\n", s.StudentID, s.Status, scoreLine(s.Score))
	}
	for _, warning := range run.Warnings {
		fmt.Fprintf(w, "\naviso %s (%s): %s", warning.Code, warning.Scope, warning.Message)
	}
	if len(run.Warnings) > 0 {
		fmt.Fprintln(w)
	}
	fmt.Fprintf(w, "\nArtefacto: %s\n", path)
}

// scoreLine describes a grade without inventing one: while a check is
// unevaluated there is a provisional number and no final number.
func scoreLine(s model.Score) string {
	switch {
	case s.Final != nil:
		return fmt.Sprintf("nota %d/100", *s.Final)
	case s.Provisional != nil:
		return fmt.Sprintf("provisional %d/100, %s de peso sin evaluar",
			*s.Provisional, formatWeight(s.Unevaluated))
	default:
		return "sin evaluar"
	}
}
