package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os/signal"
	"path/filepath"
	"syscall"

	"evalon/internal/engine"
	"evalon/internal/model"
	"evalon/internal/plan"
	"evalon/internal/report"
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
	if err := fs.Parse(args); err != nil {
		return exitInvalidConfig
	}
	if fs.NArg() != 1 {
		fmt.Fprintln(stderr, "uso: evalon run [--secrets=stdin|env] [--var=dir] <directorio del examen>")
		return exitInvalidConfig
	}

	p, err := plan.Load(fs.Arg(0))
	if err != nil {
		fmt.Fprintf(stderr, "evalon run: la configuración no es válida\n\n%s\n", err)
		return exitInvalidConfig
	}

	secrets, err := readSecrets(*secretsMode, p)
	if err != nil {
		fmt.Fprintf(stderr, "evalon run: %s\n", err)
		return exitInvalidConfig
	}
	defer func() {
		for k := range secrets {
			delete(secrets, k)
		}
	}()

	if err := engine.CheckSecrets(p, secrets); err != nil {
		fmt.Fprintf(stderr, "evalon run: faltan credenciales\n\n%s\n", err)
		return exitInvalidConfig
	}

	runID, err := report.NewRunID()
	if err != nil {
		fmt.Fprintf(stderr, "evalon run: no se pudo generar el identificador de la ejecución: %s\n", err)
		return exitFailure
	}
	writer, err := report.New(*varDir, runID, values(secrets))
	if err != nil {
		fmt.Fprintf(stderr, "evalon run: %s\n", err)
		return exitFailure
	}

	// Ctrl-C cancels the run; it does not kill the artifact. The second signal
	// is the operating system's business, not ours.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	var partialErr error
	result := engine.Run(ctx, p, engine.Options{
		RunID:          runID,
		EngineVersion:  version,
		Secrets:        secrets,
		KnownHostsPath: filepath.Join(*varDir, "known_hosts"),
		Concurrency:    *concurrency,
		OnStudentDone: func(run *model.RunResult) error {
			if err := writer.WritePartial(run); err != nil {
				partialErr = err
				return err
			}
			return nil
		},
	})

	path, err := writer.WriteFinal(result)
	if err != nil {
		fmt.Fprintf(stderr, "evalon run: no se pudo escribir el artefacto: %s\n", err)
		return exitFailure
	}
	if partialErr != nil {
		fmt.Fprintf(stderr, "evalon run: aviso: no se pudo guardar algún parcial: %s\n", partialErr)
	}

	printSummary(stdout, result, path)
	return engine.ExitCode(result)
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
