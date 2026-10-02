package main

// `consolidate` reads a chain of runs and says what the class looks like once
// all of them are taken together: the student whose machine was off on Tuesday
// and answered on Wednesday gets a closed grade, and nobody else is touched.
//
// It is read-only. It opens no connection, writes no file and rewrites no
// artifact: every run keeps its own (ADR-0007, ADR-0018 §3). What it prints is
// a view, and it says of every result which run produced it.

import (
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"heimdall/internal/model"
)

// maxChain bounds how far back a chain is followed. A retry of a retry of a
// retry is a normal Wednesday; fifty of them is a loop or a mistake, and
// reading them all would be the wrong answer either way.
const maxChain = 50

func consolidateCmd(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("consolidate", flag.ContinueOnError)
	fs.SetOutput(stderr)
	if err := fs.Parse(args); err != nil {
		return exitInvalidConfig
	}
	if fs.NArg() != 1 {
		fmt.Fprintln(stderr, "uso: heimdall consolidate <resultado.json>")
		return exitInvalidConfig
	}

	chain, err := readChain(fs.Arg(0))
	if err != nil {
		fmt.Fprintf(stderr, "heimdall consolidate: %s\n", err)
		return exitInvalidConfig
	}

	consolidated, err := model.Consolidate(chain)
	if err != nil {
		fmt.Fprintf(stderr, "heimdall consolidate: %s\n", err)
		return exitInvalidConfig
	}

	data, err := model.MarshalCanonical(consolidated)
	if err != nil {
		fmt.Fprintf(stderr, "heimdall consolidate: no se pudo escribir la consolidación: %s\n", err)
		return exitFailure
	}
	if _, err := stdout.Write(data); err != nil {
		fmt.Fprintf(stderr, "heimdall consolidate: no se pudo escribir la consolidación: %s\n", err)
		return exitFailure
	}

	// The same discrimination as a run: 0 means there is nothing left to
	// evaluate in the whole chain, 3 means there still is.
	for _, s := range consolidated.Students {
		if s.Status != model.StudentExcluded && s.Score.Status != model.ScoreComplete {
			return exitPartial
		}
	}
	return exitOK
}

// readChain walks a run back to the first one of its chain, newest first.
//
// A file that cannot be read stops the whole thing instead of consolidating
// half a chain: a missing link is exactly the part that would be silently
// counted as unevaluated, and that is the silent error of principio 2.
func readChain(path string) ([]model.ChainLink, error) {
	chain := []model.ChainLink{}
	seen := map[string]bool{}
	expectedID := ""

	for {
		run, err := readArtifact(path)
		if err != nil {
			return nil, err
		}
		if expectedID != "" && run.RunID != expectedID {
			return nil, fmt.Errorf("%s no contiene la corrección anterior %s", path, expectedID)
		}
		if seen[run.RunID] {
			return nil, fmt.Errorf(
				"la corrección %s se repite en la cadena: %s no lleva a ninguna parte", run.RunID, path)
		}
		seen[run.RunID] = true
		chain = append(chain, model.ChainLink{Artifact: path, Run: run})

		if run.RetryOf == nil {
			return chain, nil
		}
		if len(chain) >= maxChain {
			return nil, fmt.Errorf(
				"la cadena de correcciones pasa de %d: se para aquí en vez de seguir tirando del hilo", maxChain)
		}
		expectedID = run.RetryOf.RunID
		path, err = previousArtifact(path, run.RetryOf.Artifact)
		if err != nil {
			return nil, err
		}
	}
}

// previousArtifact locates the artifact a run repeated. The path recorded is
// the one the engine was given that day, so a project copied to another folder
// would lose its chain; the artifact next to the one being read is tried too,
// which is where it is in every ordinary case.
func previousArtifact(current, recorded string) (string, error) {
	if _, err := os.Stat(recorded); err == nil {
		return recorded, nil
	}
	beside := filepath.Join(filepath.Dir(current), filepath.Base(recorded))
	if _, err := os.Stat(beside); err == nil {
		return beside, nil
	}
	return "", fmt.Errorf(
		"la corrección anterior se guardó en %s y ahí no está; tampoco al lado de %s", recorded, current)
}
