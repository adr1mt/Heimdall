package ssh

import (
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

// tofuMu serialises appends to the known_hosts file: several students may be
// reaching the same host at the same time.
var tofuMu sync.Mutex

// hostKeyCallback returns a callback over the project's own known_hosts file,
// never the teacher's. First sight of a host is trusted and recorded, with a
// warning; a key that changed afterwards is refused.
//
// Trust on first use is provisional (D-3) and must be closed before the first
// real exam.
func hostKeyCallback(path string, warn func(code, message string)) (ssh.HostKeyCallback, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDONLY, 0o600)
	if err != nil {
		return nil, err
	}
	f.Close()

	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		tofuMu.Lock()
		defer tofuMu.Unlock()

		check, err := knownhosts.New(path)
		if err != nil {
			return err
		}
		err = check(hostname, remote, key)
		if err == nil {
			return nil
		}
		var ke *knownhosts.KeyError
		if !errors.As(err, &ke) || len(ke.Want) > 0 {
			return fmt.Errorf("la clave del host %s no coincide con la registrada", hostname)
		}
		// Unknown host: record it and say so.
		line := knownhosts.Line([]string{knownhosts.Normalize(hostname)}, key)
		out, oerr := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0o600)
		if oerr != nil {
			return oerr
		}
		defer out.Close()
		if _, werr := fmt.Fprintln(out, line); werr != nil {
			return werr
		}
		warn("HOST_KEY_TOFU", fmt.Sprintf("primera conexion con %s: su clave se ha aceptado y registrada en %s", hostname, path))
		return nil
	}, nil
}
