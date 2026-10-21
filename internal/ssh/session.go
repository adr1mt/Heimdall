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
	res, _ := s.exec(probeCtx, []string{"command", "-v", "timeout"}, 0, "", "", "")
	s.hasRemoteKill = res.Completed && res.ExitCode != nil && *res.ExitCode == 0
	if !s.hasRemoteKill {
		s.warn("REMOTE_TIMEOUT_UNAVAILABLE",
			fmt.Sprintf("%s no tiene el timeout de coreutils: un comando que se pase de tiempo puede quedar corriendo en la maquina", s.cfg.Host))
	}
}

// Run executes argv on the student's machine and reports what happened. It
// never blocks for longer than timeout plus the grace given to the remote kill.
func (s *Session) Run(ctx context.Context, argv []string, timeout time.Duration) *model.ExecutionResult {
	res, _ := s.run(ctx, argv, timeout, false)
	return res
}

// SudoRefused says that sudo did not start the command: a wrong password, a
// user who may not use sudo, or no sudo on the machine. Nothing of the
// student's work was looked at, so it is never a FAIL (ADR-0032).
type SudoRefused struct {
	Detail string
}

func (e *SudoRefused) Error() string { return e.Detail }

// sudoScript is the fixed text sudo runs (ADR-0032). Its first act as root is
// a private record that proves sudo accepted the password and started it; a
// run without that record never reached the command. The command gets
// /dev/null as stdin, so the password line can never be read by it, not even
// when sudo needed no password and left it unread.
func sudoScript(nonce string) string {
	return `printf '\036HEIMDALL_` + nonce + `:sudo\037' >&2; exec "$@" </dev/null`
}

// RunSudo executes argv as root through `sudo -S`, writing the session's own
// password to stdin. The password never reaches argv. When sudo does not
// start the command it says so in a *SudoRefused, alongside what the machine
// answered.
func (s *Session) RunSudo(ctx context.Context, argv []string, timeout time.Duration) (*model.ExecutionResult, *SudoRefused) {
	res, refused := s.run(ctx, argv, timeout, true)
	if !refused {
		return res, nil
	}
	if res.ExitCode != nil && *res.ExitCode == 127 {
		return res, &SudoRefused{Detail: fmt.Sprintf(
			"en %s no está instalado sudo y la comprobación necesita leer como administrador", s.cfg.Host)}
	}
	return res, &SudoRefused{Detail: fmt.Sprintf(
		"sudo no aceptó la contraseña del usuario %s en %s, o ese usuario no puede usar sudo; no se ha comprobado nada del alumno",
		s.cfg.User, s.cfg.Host)}
}

func (s *Session) run(ctx context.Context, argv []string, timeout time.Duration, sudo bool) (*model.ExecutionResult, bool) {
	sent := argv
	local := timeout
	marker := ""
	var nonce [16]byte
	if _, err := cryptorand.Read(nonce[:]); err != nil {
		panic(err)
	}
	hexNonce := hex.EncodeToString(nonce[:])
	if s.hasRemoteKill && timeout > 0 {
		marker = "\x1eHEIMDALL_" + hexNonce + ":"
		// The fixed supervisor invokes only positional arguments. Its completion
		// record distinguishes a command's own 124/137 from timeout's status.
		script := `expired=0; trap 'expired=1' TERM; "$@"; code=$?; if [ "$expired" -eq 0 ]; then printf '\036HEIMDALL_` + hexNonce + `:%s\037' "$code" >&2; fi; exit "$code"`
		secs := strconv.FormatFloat(timeout.Seconds(), 'f', -1, 64)
		sent = append([]string{"timeout", "-k", "5s", secs + "s", "sh", "-c", script, "heimdall-command"}, argv...)
		local = timeout + remoteGrace
	}
	stdin := ""
	startMarker := ""
	if sudo {
		// timeout goes inside sudo: run as the user it could not kill a
		// command that runs as root.
		sent = append([]string{"sudo", "-S", "-p", "", "--", "sh", "-c", sudoScript(hexNonce), "heimdall-sudo"}, sent...)
		stdin = s.cfg.Password + "\n"
		startMarker = "\x1eHEIMDALL_" + hexNonce + ":sudo\x1f"
	}
	res, refused := s.exec(ctx, sent, local, marker, stdin, startMarker)
	res.Command = argv // the artifact shows what the exam asked for
	return res, refused
}

// exec runs argv once. stdin, when not empty, is written to the command and
// closed. startMarker, when not empty, is the record sudoScript prints; the
// second result is true when an exit status came back without it, which means
// sudo refused to start the command.
func (s *Session) exec(ctx context.Context, argv []string, timeout time.Duration, marker, stdin, startMarker string) (*model.ExecutionResult, bool) {
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
		return res, false
	}
	sess, err := s.client.NewSession()
	if err != nil {
		res.Stdout, res.Stderr = emptyStreams()
		return res, false
	}
	defer sess.Close()
	if stdin != "" {
		sess.Stdin = strings.NewReader(stdin)
	}

	stdout, stderr := &capWriter{}, &capWriter{}
	outPipe, err := sess.StdoutPipe()
	if err != nil {
		res.Stdout, res.Stderr = emptyStreams()
		return res, false
	}
	errPipe, err := sess.StderrPipe()
	if err != nil {
		res.Stdout, res.Stderr = emptyStreams()
		return res, false
	}

	// No pty: the two streams stay separate and nothing adds terminal escapes.
	if err := sess.Start(quote(argv)); err != nil {
		res.Stdout, res.Stderr = emptyStreams()
		return res, false
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
		// that keeps it alive must not keep us waiting either: closing the
		// transport unblocks all requests and stream readers.
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
	started := startMarker == "" || stderr.consume(startMarker)
	var sanitisedOut, sanitisedErr bool
	res.Stdout, sanitisedOut = stdout.stream()
	res.Stderr, sanitisedErr = stderr.stream()
	if sanitisedOut || sanitisedErr {
		s.warn("OUTPUT_NOT_UTF8", fmt.Sprintf("la salida de %s no era UTF-8 valido y se ha saneado", s.cfg.Host))
	}
	if stdout.overflow || stderr.overflow {
		res.Overflow = true
		s.warn("OUTPUT_OVERFLOW", fmt.Sprintf("un comando en %s ha producido mas de 8 MB y se ha dejado de leer", s.cfg.Host))
		return res, false // not completed: there is no trustworthy output to compare
	}

	switch {
	case timedOut:
		return res, false
	case waitErr == nil:
		code := 0
		res.ExitCode = &code
	default:
		var ee *ssh.ExitError
		if !errors.As(waitErr, &ee) {
			// The connection dropped mid-command: nothing is known about the
			// other side.
			return res, false
		}
		code := ee.ExitStatus()
		res.ExitCode = &code
	}

	if !started {
		// An exit status with no record from sudoScript: sudo itself answered
		// and the command never ran. The status is sudo's, not the student's.
		return res, res.ExitCode != nil
	}

	if marker != "" && res.ExitCode != nil && (*res.ExitCode == 124 || *res.ExitCode == 137) && (!commandFinished || *res.ExitCode != commandCode) {
		// coreutils timeout killed it: the check timed out, and the process is
		// gone for sure.
		res.ExitCode = nil
		res.RemoteProcess = model.RemoteKilledRemote
		return res, false
	}

	if marker != "" {
		if !commandFinished || res.ExitCode == nil || *res.ExitCode != commandCode {
			res.ExitCode = nil
			return res, false
		}
	}
	res.Completed = true
	res.RemoteProcess = model.RemoteFinished
	return res, false
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
