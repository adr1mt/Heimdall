package main

// `session` reads the rounds of one exam session and says, for every student,
// what the session is worth: the best round that came out whole, which round
// it was, whether they have already finished, and what every round said.
//
// It is read-only. It opens no connection, writes no file and touches no
// artifact: every round keeps its own, with its own evidence (ADR-0007,
// ADR-0020 §7). What it prints is a view, with its own kind, and it never
// goes through `consolidate`: a retry chain and an exam session are two
// different rules and mixing them would grade the wrong round (ADR-0020).

import (
	"flag"
	"fmt"
	"io"
	"strings"

	"heimdall/internal/engine"
	"heimdall/internal/model"
	"heimdall/internal/plan"
)

func sessionCmd(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("session", flag.ContinueOnError)
	fs.SetOutput(stderr)
	if err := fs.Parse(args); err != nil {
		return exitInvalidConfig
	}
	if fs.NArg() == 0 {
		fmt.Fprintln(stderr, "uso: heimdall session <vuelta1.json> <vuelta2.json> ... (de la más antigua a la más reciente)")
		return exitInvalidConfig
	}

	rounds, err := readRounds(fs.Args())
	if err != nil {
		fmt.Fprintf(stderr, "heimdall session: %s\n", err)
		return exitInvalidConfig
	}

	session, err := model.BuildSession(rounds)
	if err != nil {
		fmt.Fprintf(stderr, "heimdall session: %s\n", err)
		return exitInvalidConfig
	}

	data, err := model.MarshalCanonical(session)
	if err != nil {
		fmt.Fprintf(stderr, "heimdall session: no se pudo escribir la sesión: %s\n", err)
		return exitFailure
	}
	if _, err := stdout.Write(data); err != nil {
		fmt.Fprintf(stderr, "heimdall session: no se pudo escribir la sesión: %s\n", err)
		return exitFailure
	}

	// The same discrimination as a run: 0 means every student of the session
	// has a closed grade, 3 means somebody still does not.
	for _, s := range session.Students {
		if s.Status != model.SessionExcluded && s.FromRound == 0 {
			return exitPartial
		}
	}
	return exitOK
}

// readRounds loads the rounds of a session in the order they are given, which
// is the order they ran (ADR-0020 §5).
//
// A round that cannot be read stops the whole thing: reading a session with a
// round missing would answer "the best round was this one" about a session
// that is not the one the teacher ran.
func readRounds(paths []string) ([]model.SessionRound, error) {
	rounds := make([]model.SessionRound, 0, len(paths))
	seen := map[string]string{}
	for _, path := range paths {
		run, err := readArtifact(path)
		if err != nil {
			return nil, err
		}
		if before, dup := seen[run.RunID]; dup {
			return nil, fmt.Errorf(
				"la vuelta %s está dos veces en la sesión: %s y %s", run.RunID, before, path)
		}
		seen[run.RunID] = path
		rounds = append(rounds, model.SessionRound{Artifact: path, Run: run})
	}
	return rounds, nil
}

// roundList collects a flag given once per round, oldest first. The order is
// the caller's and it is not sorted here: the engine does not know when a file
// was renamed or copied, and guessing the order would make "which round the
// grade comes from" a guess too.
type roundList []string

func (l *roundList) String() string     { return strings.Join(*l, ", ") }
func (l *roundList) Set(v string) error { *l = append(*l, v); return nil }

// excludeFinished reads the rounds of the session and leaves out of this one
// the students it already finished.
//
// The whole session is resolved here, before the first connection: a round
// from another exam ends the run with exit 2 and an untouched classroom, not
// with a class corrected against the wrong denominator (ADR-0002).
func excludeFinished(p *plan.Plan, paths []string) error {
	rounds, err := readRounds(paths)
	if err != nil {
		return err
	}
	session, err := model.BuildSession(rounds)
	if err != nil {
		return err
	}
	if _, err := engine.ExcludeFinished(p, session); err != nil {
		return err
	}
	return nil
}
