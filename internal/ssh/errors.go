package ssh

import (
	"errors"
	"strings"

	"evalon/internal/model"
)

// errOverflow stops the reader when a stream passes the hard limit.
var errOverflow = errors.New("salida desbordada")

// DialError says why a session could not be opened, in the same vocabulary the
// artifact uses. It carries one sentence, never a stack trace.
type DialError struct {
	Cause    model.Cause
	Detail   string
	Attempts int
}

func (e *DialError) Error() string { return e.Detail }

// isAuthFailure reports whether the server rejected the credentials. That is
// deterministic: retrying will not change it and may lock the account.
func isAuthFailure(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "unable to authenticate") ||
		strings.Contains(msg, "no supported methods remain")
}
