// Package ssh opens one session per student and host and runs commands on it.
// It states facts about the process and knows nothing about grades: what it
// produces is a model.ExecutionResult, never a status.
//
// See docs/design/05-SECRETOS-TIMEOUTS-REINTENTOS.md.
package ssh

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"

	"heimdall/internal/model"
)

const (
	// DefaultConnectTimeout covers TCP plus handshake plus authentication.
	DefaultConnectTimeout = 10 * time.Second
	// maxDials is one attempt plus two retries.
	maxDials = 3
	// remoteGrace is how long the local clock waits beyond the remote timeout,
	// so that `timeout -k 5s` gets to kill the process and report it.
	remoteGrace = 8 * time.Second
	// closeGrace bounds how long a timed-out command may hold the worker after
	// its channel was closed.
	closeGrace = 2 * time.Second
	// transport names what the artifact records for every execution here.
	transport = "ssh"
)

// backoff is the wait before each retry, plus jitter. Never after the command
// was sent.
var backoff = []time.Duration{time.Second, 3 * time.Second}

// Config describes one student's host. The password lives in memory only: it
// never reaches argv, a log or the artifact.
type Config struct {
	Host           string // logical name in the inventory
	Address        string // ip
	Port           int
	User           string
	Password       string
	ConnectTimeout time.Duration

	// Keys is the identity registry of the run, shared by every session.
	// A nil registry is one private to this session, which accepts the
	// machine it finds: only tests dial without one.
	Keys *HostKeys
}

// Session is one authenticated connection, reused for every check of that
// student on that host (K-6).
type Session struct {
	cfg      Config
	client   *ssh.Client
	attempts int

	mu            sync.Mutex
	warnings      []model.Warning
	hasRemoteKill bool // the machine has coreutils timeout
	// identityChanged is set when the host key callback refused the machine.
	// The handshake error that comes back has lost the cause by then, so the
	// callback leaves it here.
	identityChanged error
}

func (c Config) addr() string {
	return net.JoinHostPort(c.Address, strconv.Itoa(c.Port))
}

// Dial opens the session, retrying only what provably did not run. An
// authentication failure is never retried.
func Dial(ctx context.Context, cfg Config) (*Session, *DialError) {
	if cfg.ConnectTimeout <= 0 {
		cfg.ConnectTimeout = DefaultConnectTimeout
	}
	if cfg.Keys == nil {
		cfg.Keys = NewHostKeys()
	}
	s := &Session{cfg: cfg}

	clientCfg := &ssh.ClientConfig{
		User:            cfg.User,
		Auth:            []ssh.AuthMethod{ssh.Password(cfg.Password)},
		HostKeyCallback: hostKeyCallback(cfg.Keys, cfg.addr(), s.warn, s.refuseIdentity),
		Timeout:         cfg.ConnectTimeout,
	}

	var last error
	for attempt := 1; attempt <= maxDials; attempt++ {
		s.attempts = attempt
		client, derr := dialOnce(ctx, cfg, clientCfg)
		if derr == nil {
			s.client = client
			s.probeRemoteTimeout(ctx)
			return s, nil
		}
		last = derr
		if refusal := s.identity(); refusal != nil {
			return nil, &DialError{
				Cause:    model.CauseConnectFailed,
				Detail:   oneLine(refusal),
				Attempts: 1, // retrying would only ask the same impostor again
			}
		}
		if isAuthFailure(derr) {
			return nil, &DialError{
				Cause:    model.CauseAuthFailed,
				Detail:   fmt.Sprintf("el servidor %s ha rechazado las credenciales del usuario %s", cfg.addr(), cfg.User),
				Attempts: 1, // never retried: it would not change, and it can lock the account
			}
		}
		if ctx.Err() != nil {
			return nil, &DialError{Cause: model.CauseCancelled, Detail: "conexion cancelada", Attempts: attempt}
		}
		if attempt < maxDials {
			if !sleepCtx(ctx, backoff[attempt-1]+jitter()) {
				return nil, &DialError{Cause: model.CauseCancelled, Detail: "conexion cancelada", Attempts: attempt}
			}
		}
	}
	return nil, &DialError{
		Cause:    model.CauseConnectFailed,
		Detail:   fmt.Sprintf("no se ha podido conectar con %s tras %d intentos: %s", cfg.addr(), maxDials, oneLine(last)),
		Attempts: maxDials,
	}
}

func dialOnce(ctx context.Context, cfg Config, clientCfg *ssh.ClientConfig) (*ssh.Client, error) {
	dialCtx, cancel := context.WithTimeout(ctx, cfg.ConnectTimeout)
	defer cancel()

	var d net.Dialer
	conn, err := d.DialContext(dialCtx, "tcp", cfg.addr())
	if err != nil {
		return nil, err
	}
	// The handshake gets the rest of the same budget.
	if deadline, ok := dialCtx.Deadline(); ok {
		conn.SetDeadline(deadline)
	}
	stopClose := context.AfterFunc(dialCtx, func() { _ = conn.Close() })
	defer stopClose()
	c, chans, reqs, err := ssh.NewClientConn(conn, cfg.addr(), clientCfg)
	if err != nil {
		conn.Close()
		return nil, err
	}
	if dialCtx.Err() != nil {
		conn.Close()
		return nil, dialCtx.Err()
	}
	stopClose()
	conn.SetDeadline(time.Time{})
	return ssh.NewClient(c, chans, reqs), nil
}

// Close ends the connection. It does not kill anything left running on the
// other side: see remote_process.
func (s *Session) Close() error {
	if s.client == nil {
		return nil
	}
	return s.client.Close()
}

// Warnings returns what the teacher must know about this host.
func (s *Session) Warnings() []model.Warning {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]model.Warning(nil), s.warnings...)
}

// refuseIdentity records why the machine was refused, before the handshake
// error buries it.
func (s *Session) refuseIdentity(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.identityChanged = err
}

func (s *Session) identity() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.identityChanged
}

func (s *Session) warn(code, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.warnings = append(s.warnings, model.Warning{
		Scope:   "host:" + s.cfg.Host,
		Code:    code,
		Message: message,
	})
}

// probeRemoteTimeout asks once per host whether coreutils timeout is there. If
// it is not, a command that overruns leaves a process we cannot account for,
// and the teacher is told.
func (s *Session) probeRemoteTimeout(ctx context.Context) {
	probeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	res := s.exec(probeCtx, []string{"command", "-v", "timeout"}, 0, "")
	s.hasRemoteKill = res.Completed && res.ExitCode != nil && *res.ExitCode == 0
	if !s.hasRemoteKill {
		s.warn("REMOTE_TIMEOUT_UNAVAILABLE",
			fmt.Sprintf("%s no tiene el timeout de coreutils: un comando que se pase de tiempo puede quedar corriendo en la maquina", s.cfg.Host))
	}
}

// Run executes argv on the student's machine and reports what happened. It
// never blocks for longer than timeout plus the grace given to the remote kill.
func (s *Session) Run(ctx context.Context, argv []string, timeout time.Duration) *model.ExecutionResult {
	sent := argv
	local := timeout
	marker := ""
	if s.hasRemoteKill && timeout > 0 {
		var nonce [16]byte
		if _, err := cryptorand.Read(nonce[:]); err != nil {
			panic(err)
		}
		marker = "\x1eHEIMDALL_" + hex.EncodeToString(nonce[:]) + ":"
		// The fixed supervisor invokes only positional arguments. Its completion
		// record distinguishes a command's own 124/137 from timeout's status.
		script := `trap ':' TERM; "$@"; code=$?; printf '\036HEIMDALL_` + hex.EncodeToString(nonce[:]) + `:%s\037' "$code" >&2; exit "$code"`
		secs := strconv.FormatFloat(timeout.Seconds(), 'f', -1, 64)
		sent = append([]string{"timeout", "-k", "5s", secs + "s", "sh", "-c", script, "heimdall-command"}, argv...)
		local = timeout + remoteGrace
	}
	res := s.exec(ctx, sent, local, marker)
	res.Command = argv // the artifact shows what the exam asked for
	return res
}

func (s *Session) exec(ctx context.Context, argv []string, timeout time.Duration, marker string) *model.ExecutionResult {
	res := &model.ExecutionResult{
		Host:            s.cfg.Host,
		Address:         s.cfg.addr(),
		User:            s.cfg.User,
		Transport:       transport,
		Command:         argv,
		StartedAt:       time.Now(),
		ConnectAttempts: s.attempts,
		CommandAttempts: 1,
		RemoteProcess:   model.RemoteUnknown,
	}
	start := time.Now()
	res.Stdout, res.Stderr = emptyStreams()
	defer func() { res.DurationMS = time.Since(start).Milliseconds() }()

	runCtx := ctx
	if timeout > 0 {
		var cancel context.CancelFunc
		runCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	// Closing the transport releases NewSession, Start, Wait and stream reads.
	stopClose := context.AfterFunc(runCtx, func() { _ = s.client.Close() })
	defer stopClose()
	if runCtx.Err() != nil {
		return res
	}
	sess, err := s.client.NewSession()
	if err != nil {
		res.Stdout, res.Stderr = emptyStreams()
		return res
	}
	defer sess.Close()

	stdout, stderr := &capWriter{}, &capWriter{}
	outPipe, err := sess.StdoutPipe()
	if err != nil {
		res.Stdout, res.Stderr = emptyStreams()
		return res
	}
	errPipe, err := sess.StderrPipe()
	if err != nil {
		res.Stdout, res.Stderr = emptyStreams()
		return res
	}

	// No pty: the two streams stay separate and nothing adds terminal escapes.
	if err := sess.Start(quote(argv)); err != nil {
		res.Stdout, res.Stderr = emptyStreams()
		return res
	}

	var wg sync.WaitGroup
	wg.Add(2)
	// Hitting the hard limit ends the session at once: the remote side would
	// otherwise keep pushing bytes nobody reads until the timeout.
	go func() {
		defer wg.Done()
		drain(stdout, outPipe)
		if stdout.overflow {
			sess.Close()
		}
	}()
	go func() {
		defer wg.Done()
		drain(stderr, errPipe)
		if stderr.overflow {
			sess.Close()
		}
	}()

	done := make(chan error, 1)
	go func() { done <- sess.Wait() }()

	var waitErr error
	timedOut := false
	// duration_ms measures until the exit status arrives or the check times
	// out, not the cleanup that follows.
	select {
	case waitErr = <-done:
	case <-runCtx.Done():
		timedOut = true
		// Closing the channel does not kill the remote process, and a server
		// that keeps it alive must not keep us waiting either: we give the
		// close a short grace and then report what we have.
		res.DurationMS = time.Since(start).Milliseconds()
		s.client.Close()
		<-done
		wg.Wait()
	}
	if !timedOut {
		res.DurationMS = time.Since(start).Milliseconds()
		drained := make(chan struct{})
		go func() { wg.Wait(); close(drained) }()
		select {
		case <-drained:
		case <-runCtx.Done():
			timedOut = true
			s.client.Close()
			<-drained
		}
	}

	commandCode, commandFinished := stderr.completion(marker)
	var sanitisedOut, sanitisedErr bool
	res.Stdout, sanitisedOut = stdout.stream()
	res.Stderr, sanitisedErr = stderr.stream()
	if sanitisedOut || sanitisedErr {
		s.warn("OUTPUT_NOT_UTF8", fmt.Sprintf("la salida de %s no era UTF-8 valido y se ha saneado", s.cfg.Host))
	}
	if stdout.overflow || stderr.overflow {
		res.Overflow = true
		s.warn("OUTPUT_OVERFLOW", fmt.Sprintf("un comando en %s ha producido mas de 8 MB y se ha dejado de leer", s.cfg.Host))
		return res // not completed: there is no trustworthy output to compare
	}

	switch {
	case timedOut:
		return res
	case waitErr == nil:
		code := 0
		res.ExitCode = &code
	default:
		var ee *ssh.ExitError
		if !errors.As(waitErr, &ee) {
			// The connection dropped mid-command: nothing is known about the
			// other side.
			return res
		}
		code := ee.ExitStatus()
		res.ExitCode = &code
	}

	if marker != "" && res.ExitCode != nil && (*res.ExitCode == 124 || *res.ExitCode == 137) && (!commandFinished || *res.ExitCode != commandCode) {
		// coreutils timeout killed it: the check timed out, and the process is
		// gone for sure.
		res.ExitCode = nil
		res.RemoteProcess = model.RemoteKilledRemote
		return res
	}

	if marker != "" {
		if !commandFinished || res.ExitCode == nil || *res.ExitCode != commandCode {
			return res
		}
	}
	res.Completed = true
	res.RemoteProcess = model.RemoteFinished
	return res
}

// waitFor drains c or gives up after d.
func waitFor(c <-chan error, d time.Duration) {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-c:
	case <-t.C:
	}
}

// waitGroupFor waits for wg or gives up after d. The readers left behind are
// capped, so abandoning them cannot grow memory.
func waitGroupFor(wg *sync.WaitGroup, d time.Duration) {
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-done:
	case <-t.C:
	}
}

func emptyStreams() (model.Stream, model.Stream) {
	var w capWriter
	a, _ := w.stream()
	b, _ := w.stream()
	return a, b
}

// quote renders the argument vector for the remote exec request. There is no
// shell on our side: every argument is passed through literally, with single
// quotes, so that spaces, quotes and `;` reach the process as written.
func quote(argv []string) string {
	parts := make([]string, len(argv))
	for i, a := range argv {
		parts[i] = "'" + strings.ReplaceAll(a, "'", `'\''`) + "'"
	}
	return strings.Join(parts, " ")
}

func jitter() time.Duration {
	return time.Duration(rand.Int63n(int64(500 * time.Millisecond)))
}

func sleepCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return true
	case <-ctx.Done():
		return false
	}
}

func oneLine(err error) string {
	if err == nil {
		return ""
	}
	return strings.TrimSpace(strings.ReplaceAll(err.Error(), "\n", " "))
}
