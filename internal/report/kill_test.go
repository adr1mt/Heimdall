package report

import (
	"os"
	"syscall"
)

// syscallKillSelf ends this process the way a crash or an OOM would: with no
// deferred function, no flush and no chance to tidy up.
func syscallKillSelf() error {
	return syscall.Kill(os.Getpid(), syscall.SIGKILL)
}
