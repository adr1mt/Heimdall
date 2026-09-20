//go:build integration

// Integration tests against the podman lab: `make lab` first.
// The credentials here are fictitious and only valid inside the container.
package ssh

import (
	"context"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"testing"
	"time"

	"heimdall/internal/model"
)

const (
	labAddress  = "127.1.2.3" // never 127.0.0.x: F-01
	labPort     = 2201
	closedPort  = 2299
	labUser     = "alumno"
	labPassword = "TEUTON_SECRET_TEST_12345"
)

func labConfig(t *testing.T) Config {
	t.Helper()
	return Config{
		Host:     "host1",
		Address:  labAddress,
		Port:     labPort,
		User:     labUser,
		Password: labPassword,
		Keys:     NewHostKeys(),
	}
}

func dialLab(t *testing.T) *Session {
	t.Helper()
	s, err := Dial(context.Background(), labConfig(t))
	if err != nil {
		t.Fatalf("Dial: %v (is `make lab` up?)", err.Detail)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestRunSeparatesTheTwoStreamsAndReportsTheExitCode(t *testing.T) {
	s := dialLab(t)
	res := s.Run(context.Background(), []string{"sh", "-c", "echo salida; echo error >&2; exit 3"}, 20*time.Second)

	if !res.Completed {
		t.Fatalf("completed = false, want true")
	}
	if res.ExitCode == nil || *res.ExitCode != 3 {
		t.Errorf("exit_code = %v, want 3", res.ExitCode)
	}
	if strings.TrimSpace(res.Stdout.Text) != "salida" {
		t.Errorf("stdout = %q, want %q", res.Stdout.Text, "salida")
	}
	if strings.TrimSpace(res.Stderr.Text) != "error" {
		t.Errorf("stderr = %q, want %q: the streams must never be merged", res.Stderr.Text, "error")
	}
	if res.RemoteProcess != model.RemoteFinished {
		t.Errorf("remote_process = %q, want FINISHED", res.RemoteProcess)
	}
	if res.ConnectAttempts != 1 || res.CommandAttempts != 1 {
		t.Errorf("attempts = %d/%d, want 1/1", res.ConnectAttempts, res.CommandAttempts)
	}
}

// The identity of a machine seen for the first time is accepted, reported
// with its fingerprint, and not reported again for the rest of the run
// (ADR-0011).
func TestFirstSightOfAHostIsAcceptedAndReported(t *testing.T) {
	cfg := labConfig(t)
	s, err := Dial(context.Background(), cfg)
	if err != nil {
		t.Fatalf("Dial: %v", err.Detail)
	}
	defer s.Close()

	var fingerprint string
	for _, w := range s.Warnings() {
		if w.Code == "HOST_KEY_ACCEPTED" {
			fingerprint = w.Message
		}
	}
	if fingerprint == "" {
		t.Fatalf("warnings = %v, want HOST_KEY_ACCEPTED on first sight", s.Warnings())
	}
	if !strings.Contains(fingerprint, "SHA256:") {
		t.Errorf("el aviso no dice qué identidad se aceptó: %q", fingerprint)
	}

	// Second connection to the same machine within the run: already known,
	// no new warning.
	s2, err := Dial(context.Background(), cfg)
	if err != nil {
		t.Fatalf("second Dial: %v", err.Detail)
	}
	defer s2.Close()
	for _, w := range s2.Warnings() {
		if w.Code == "HOST_KEY_ACCEPTED" {
			t.Error("se volvió a avisar de una identidad ya anotada en esta ejecución")
		}
	}
}

// A machine that answers with an identity other than the one it presented at
// the start of the run is refused, out loud. This is the acceptance of T021:
// what must never happen is a grade that quietly came from another machine.
func TestAMachineThatChangesItsIdentityIsRefused(t *testing.T) {
	cfg := labConfig(t)

	// The same registry, with the address already recorded under a different
	// identity: exactly what the engine would hold after the first student.
	first, err := Dial(context.Background(), cfg)
	if err != nil {
		t.Fatalf("Dial: %v", err.Detail)
	}
	first.Close()

	cfg.Keys.mu.Lock()
	cfg.Keys.seen[cfg.addr()] = "SHA256:otra-maquina-distinta"
	cfg.Keys.mu.Unlock()

	s, derr := Dial(context.Background(), cfg)
	if derr == nil {
		s.Close()
		t.Fatal("se aceptó una máquina con una identidad distinta de la registrada")
	}
	if derr.Cause != model.CauseConnectFailed {
		t.Errorf("causa = %q, se esperaba CONNECT_FAILED", derr.Cause)
	}
	if derr.Attempts != 1 {
		t.Errorf("intentos = %d: una identidad cambiada no se reintenta", derr.Attempts)
	}
	if !strings.Contains(derr.Detail, "identidad distinta") {
		t.Errorf("el motivo no lo explica: %q", derr.Detail)
	}
}

func TestRunKillsTheRemoteProcessOnTimeout(t *testing.T) {
	s := dialLab(t)
	res := s.Run(context.Background(), []string{"sleep", "30"}, 3*time.Second)

	if res.Completed {
		t.Fatal("completed = true on a command that never finished")
	}
	if res.ExitCode != nil {
		t.Errorf("exit_code = %v, want null when the command did not complete", *res.ExitCode)
	}
	if res.DurationMS < 3000 || res.DurationMS > 4000 {
		t.Errorf("duration_ms = %d, want between 3000 and 4000", res.DurationMS)
	}
	if res.RemoteProcess != model.RemoteKilledRemote {
		t.Errorf("remote_process = %q, want KILLED_REMOTE", res.RemoteProcess)
	}
}

func TestDialOnAClosedPortFailsAfterThreeAttempts(t *testing.T) {
	cfg := labConfig(t)
	cfg.Port = closedPort
	start := time.Now()
	_, err := Dial(context.Background(), cfg)
	if err == nil {
		t.Fatal("Dial succeeded on a closed port")
	}
	if err.Cause != model.CauseConnectFailed {
		t.Errorf("cause = %q, want CONNECT_FAILED", err.Cause)
	}
	if err.Attempts != 3 {
		t.Errorf("connect_attempts = %d, want 3", err.Attempts)
	}
	if d := time.Since(start); d > 30*time.Second {
		t.Errorf("took %s: it must never hang", d)
	}
}

func TestDialNeverRetriesRejectedCredentials(t *testing.T) {
	cfg := labConfig(t)
	cfg.Password = "no-es-la-contrasena"
	_, err := Dial(context.Background(), cfg)
	if err == nil {
		t.Fatal("Dial succeeded with the wrong password")
	}
	if err.Cause != model.CauseAuthFailed {
		t.Errorf("cause = %q, want AUTH_FAILED", err.Cause)
	}
	if err.Attempts != 1 {
		t.Errorf("connect_attempts = %d, want 1: retrying can lock the account", err.Attempts)
	}
	if strings.Contains(err.Detail, cfg.Password) {
		t.Error("the password leaked into the error detail")
	}
}

func TestRunCapsAHugeOutputWithoutGrowingInMemory(t *testing.T) {
	s := dialLab(t)
	var before runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&before)

	start := time.Now()
	res := s.Run(context.Background(), []string{"head", "-c", "300000000", "/dev/zero"}, 60*time.Second)
	elapsed := time.Since(start)

	var after runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&after)

	if res.Stdout.Bytes > 65536 {
		t.Errorf("bytes = %d, want at most 65536", res.Stdout.Bytes)
	}
	if res.Stdout.BytesTotal <= 65536 {
		t.Errorf("bytes_total = %d, want the real size to be reported", res.Stdout.BytesTotal)
	}
	if !res.Stdout.Truncated {
		t.Error("truncated = false on a capped stream")
	}
	if elapsed > 30*time.Second {
		t.Errorf("took %s: the hard limit must end the command, not wait for the timeout", elapsed)
	}
	if res.Completed {
		t.Error("completed = true: an overflowed stream is not a trustworthy comparison")
	}
	if grew := int64(after.HeapAlloc) - int64(before.HeapAlloc); grew > 100*1024*1024 {
		t.Errorf("heap grew %d bytes: memory must not follow the student's output", grew)
	}
}

func TestPasswordNeverReachesArgv(t *testing.T) {
	s := dialLab(t)
	s.Run(context.Background(), []string{"true"}, 20*time.Second)

	cmdline, err := os.ReadFile("/proc/self/cmdline")
	if err != nil {
		t.Skip("no /proc on this machine")
	}
	if strings.Contains(string(cmdline), labPassword) {
		t.Fatal("the password is visible in argv")
	}
}

// TestHostWithoutCoreutilsTimeout hides the binary inside the lab container so
// that the degraded path is exercised for real, not simulated.
func TestHostWithoutCoreutilsTimeout(t *testing.T) {
	mask := func(args ...string) {
		t.Helper()
		if out, err := exec.Command("podman", append([]string{"exec", "alu1"}, args...)...).CombinedOutput(); err != nil {
			t.Skipf("cannot reach the lab container: %v: %s", err, out)
		}
	}
	mask("mv", "/usr/bin/timeout", "/usr/bin/timeout.hidden")
	t.Cleanup(func() { mask("mv", "/usr/bin/timeout.hidden", "/usr/bin/timeout") })

	s := dialLab(t)
	var found bool
	for _, w := range s.Warnings() {
		if w.Code == "REMOTE_TIMEOUT_UNAVAILABLE" {
			found = true
		}
	}
	if !found {
		t.Errorf("warnings = %v, want REMOTE_TIMEOUT_UNAVAILABLE", s.Warnings())
	}

	res := s.Run(context.Background(), []string{"sleep", "30"}, 3*time.Second)
	if res.Completed {
		t.Fatal("completed = true on a command that never finished")
	}
	if res.RemoteProcess != model.RemoteUnknown {
		t.Errorf("remote_process = %q, want UNKNOWN: the process may still be running", res.RemoteProcess)
	}
	if res.DurationMS < 3000 || res.DurationMS > 4000 {
		t.Errorf("duration_ms = %d, want between 3000 and 4000", res.DurationMS)
	}
}
