package main

import (
	"flag"
	"fmt"
	"io"
	"strconv"

	"heimdall/internal/plan"
)

// checkCmd resolves the PLAN and prints it. It opens no connection and writes
// no file: it is what lets the teacher see the exact number of checks and the
// exact total weight before the exam starts (ADR-0002).
func checkCmd(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("check", flag.ContinueOnError)
	fs.SetOutput(stderr)
	cname := fs.String("cname", "", "nombre del fichero de aula, sin la extensión; por defecto aula.yaml")
	if err := fs.Parse(args); err != nil {
		return exitInvalidConfig
	}
	if fs.NArg() != 1 {
		fmt.Fprintln(stderr, "uso: heimdall check [--cname=aula] <directorio del examen>")
		return exitInvalidConfig
	}

	p, err := plan.LoadNamed(fs.Arg(0), *cname)
	if err != nil {
		fmt.Fprintf(stderr, "heimdall check: la configuración no es válida\n\n%s\n", err)
		return exitInvalidConfig
	}

	evaluable, excluded := 0, 0
	for _, s := range p.Students {
		if s.Excluded {
			excluded++
		} else {
			evaluable++
		}
	}

	fmt.Fprintf(stdout, "Examen:         %s\n", p.ExamName)
	fmt.Fprintf(stdout, "Aula:           %s\n", p.InventoryName)
	fmt.Fprintf(stdout, "Alumnos:        %d evaluables", evaluable)
	if excluded > 0 {
		fmt.Fprintf(stdout, ", %d excluidos", excluded)
	}
	fmt.Fprintf(stdout, "\n")
	fmt.Fprintf(stdout, "Comprobaciones: %d\n", p.Summary.CheckCount)
	fmt.Fprintf(stdout, "Peso total:     %s\n", formatWeight(p.Summary.TotalWeight))
	fmt.Fprintf(stdout, "Concurrencia:   %d alumnos a la vez, %d conexiones por máquina\n",
		p.Summary.Concurrency, p.Summary.HostConcurrency)
	fmt.Fprintf(stdout, "Hash del plan:  %s\n", p.Hash)
	return exitOK
}

func formatWeight(w float64) string {
	return strconv.FormatFloat(w, 'f', -1, 64)
}
