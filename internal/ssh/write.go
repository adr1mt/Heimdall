package ssh

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/ssh"
)

// writeHomeScript is the only thing Heimdall ever writes on a student's
// machine (ADR-0031). It is fixed text: the file name arrives as $1 and is
// never interpolated into the program. The content comes on stdin.
//
// It writes into a new temporary file of the home directory and renames it
// over the target, so the report of the same exam is replaced whole and never
// left half written. A symlink with that name is replaced, not followed; a
// directory with that name is left alone.
const writeHomeScript = `cd || exit 13; umask 077; [ ! -d "$1" ] || exit 10; t=$(mktemp ./.heimdall-XXXXXX) || exit 11; cat > "$t" && chmod 644 "$t" && mv -f "$t" "$1" && exit 0; rm -f "$t"; exit 12`

// WriteHome leaves data in the home directory of the user this session logged
// in as, under name, with permissions 0644. It returns one sentence when the
// file is not there for sure.
func (s *Session) WriteHome(ctx context.Context, name string, data []byte, timeout time.Duration) error {
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	stopClose := context.AfterFunc(runCtx, func() { _ = s.client.Close() })
	defer stopClose()

	sess, err := s.client.NewSession()
	if err != nil {
		return writeFailure(runCtx, timeout, err)
	}
	defer sess.Close()
	sess.Stdin = bytes.NewReader(data)
	err = sess.Run(quote([]string{"sh", "-c", writeHomeScript, "heimdall-deliver", name}))
	if err == nil {
		return nil
	}
	var ee *ssh.ExitError
	if errors.As(err, &ee) {
		switch ee.ExitStatus() {
		case 10:
			return fmt.Errorf("en su carpeta personal hay una carpeta llamada %s y no se ha tocado", name)
		case 13:
			return fmt.Errorf("el usuario %s no tiene carpeta personal en la máquina", s.cfg.User)
		default:
			return fmt.Errorf("la máquina no dejó escribir el fichero en la carpeta personal de %s (código %d)", s.cfg.User, ee.ExitStatus())
		}
	}
	return writeFailure(runCtx, timeout, err)
}

func writeFailure(ctx context.Context, timeout time.Duration, err error) error {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return fmt.Errorf("la escritura no terminó en %s", timeout)
	}
	if ctx.Err() != nil {
		return fmt.Errorf("envío cancelado")
	}
	return fmt.Errorf("se cortó la conexión mientras se escribía: %s", oneLine(err))
}
