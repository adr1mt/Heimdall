package plan

import (
	"errors"
	"fmt"
	"sort"
)

// Error is a configuration error the teacher has to fix. It always carries the
// file and the line, because "clave desconocida" without a line is useless to
// someone who does not read code (quality.md).
//
// The message is in Spanish: it is printed to the teacher, not to a log.
type Error struct {
	File string
	Line int
	Msg  string
}

func (e *Error) Error() string {
	if e.File == "" {
		return fmt.Sprintf("línea %d: %s", e.Line, e.Msg)
	}
	return fmt.Sprintf("%s:%d: %s", e.File, e.Line, e.Msg)
}

func errf(line int, format string, a ...any) *Error {
	return &Error{Line: line, Msg: fmt.Sprintf(format, a...)}
}

// join returns all the errors found in one pass, ordered by line, so a file
// with three unknown keys is fixed in one edit instead of three runs.
func join(errs []error) error {
	if len(errs) == 0 {
		return nil
	}
	sort.SliceStable(errs, func(i, j int) bool {
		return lineOf(errs[i]) < lineOf(errs[j])
	})
	return errors.Join(errs...)
}

func lineOf(err error) int {
	var e *Error
	if errors.As(err, &e) {
		return e.Line
	}
	return 0
}

// withFile stamps the file name on every Error in the tree. Nested
// unmarshalers only know the line; the file is known here.
func withFile(file string, err error) error {
	switch v := err.(type) {
	case nil:
		return nil
	case *Error:
		if v.File == "" {
			v.File = file
		}
	case interface{ Unwrap() []error }:
		for _, e := range v.Unwrap() {
			withFile(file, e)
		}
	}
	return err
}
