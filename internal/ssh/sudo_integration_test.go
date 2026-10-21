//go:build integration

package ssh

import (
	"context"
	"strings"
	"testing"
	"time"
)

// TestRunSudoReadsARootOnlyFile: /etc/kea is root's only in the lab, as on
// Ubuntu 26.04. Without sudo the command fails; with sudo it reads the file,
// and nothing of the mechanism leaks into the evidence.
func TestRunSudoReadsARootOnlyFile(t *testing.T) {
	s := dialLab(t)
	argv := []string{"cat", "/etc/kea/kea-dhcp4.conf"}

	plain := s.Run(context.Background(), argv, 20*time.Second)
	if !plain.Completed || plain.ExitCode == nil || *plain.ExitCode == 0 {
		t.Fatalf("sin sudo el fichero no debería poder leerse: %+v", plain)
	}

	res, refused := s.RunSudo(context.Background(), argv, 20*time.Second)
	if refused != nil {
		t.Fatalf("sudo rechazado: %s (stderr %q)", refused.Detail, res.Stderr.Text)
	}
	if !res.Completed || res.ExitCode == nil || *res.ExitCode != 0 {
		t.Fatalf("con sudo debía terminar con 0: %+v", res)
	}
	if res.Stdout.Text != "subnet4 solo-root\n" || res.Stderr.Text != "" || res.Stderr.BytesTotal != 0 {
		t.Fatalf("stdout %q stderr %q (%d bytes)", res.Stdout.Text, res.Stderr.Text, res.Stderr.BytesTotal)
	}
	if strings.Join(res.Command, " ") != "cat /etc/kea/kea-dhcp4.conf" {
		t.Fatalf("el artefacto debe mostrar el comando del examen, muestra %q", res.Command)
	}
}

// TestRunSudoKeepsTheCommandAcademic: a command that fails under sudo is the
// student's failure, not a refusal of sudo; and the command cannot read the
// password from its stdin.
func TestRunSudoKeepsTheCommandAcademic(t *testing.T) {
	s := dialLab(t)
	res, refused := s.RunSudo(context.Background(), []string{"sh", "-c", "id -u; cat; exit 3"}, 20*time.Second)
	if refused != nil {
		t.Fatalf("sudo rechazado: %s", refused.Detail)
	}
	if !res.Completed || res.ExitCode == nil || *res.ExitCode != 3 {
		t.Fatalf("exit_code = %v, se esperaba 3", res.ExitCode)
	}
	if res.Stdout.Text != "0\n" {
		t.Fatalf("stdout = %q: el comando debía correr como root y no leer nada por stdin", res.Stdout.Text)
	}
	if strings.Contains(res.Stdout.Text+res.Stderr.Text, labPassword) {
		t.Fatal("la contraseña ha llegado a la salida del comando")
	}
}

// TestRunSudoRefusedIsNotTheStudents: a user who may not use sudo gets a
// refusal, not an execution to grade.
func TestRunSudoRefusedIsNotTheStudents(t *testing.T) {
	cfg := labConfig(t)
	cfg.User = "invitado"
	s, err := Dial(context.Background(), cfg)
	if err != nil {
		t.Fatalf("Dial: %v", err.Detail)
	}
	defer s.Close()
	res, refused := s.RunSudo(context.Background(), []string{"cat", "/etc/kea/kea-dhcp4.conf"}, 20*time.Second)
	if refused == nil {
		t.Fatalf("invitado no es sudoer y no se ha detectado: %+v", res)
	}
	if !strings.Contains(refused.Detail, "invitado") {
		t.Fatalf("el motivo debe nombrar al usuario: %q", refused.Detail)
	}
	if strings.Contains(res.Stdout.Text+res.Stderr.Text+refused.Detail, labPassword) {
		t.Fatal("la contraseña ha llegado a la evidencia")
	}
}

// TestRunSudoTimeoutKillsTheRootProcess: the remote limit lives inside sudo,
// so a command running as root is still killed and reported as such.
func TestRunSudoTimeoutKillsTheRootProcess(t *testing.T) {
	s := dialLab(t)
	res, refused := s.RunSudo(context.Background(), []string{"sleep", "31.7"}, 2*time.Second)
	if refused != nil {
		t.Fatalf("sudo rechazado: %s", refused.Detail)
	}
	if res.Completed || res.RemoteProcess != "KILLED_REMOTE" {
		t.Fatalf("se esperaba KILLED_REMOTE, es %s (completed=%v)", res.RemoteProcess, res.Completed)
	}
	// Other tests of the suite leave sleeps of their own: look for this one.
	left := s.Run(context.Background(), []string{"sh", "-c", "ps -eo pid,user,args | grep '[s]leep 31.7' || true"}, 10*time.Second)
	if strings.TrimSpace(left.Stdout.Text) != "" {
		t.Fatalf("queda un sleep vivo en la máquina: %q", left.Stdout.Text)
	}
}

// TestRunSudoPasswordNotInArgv: while the command runs, no process on the
// machine has the password in its command line.
func TestRunSudoPasswordNotInArgv(t *testing.T) {
	s := dialLab(t)
	done := make(chan struct{})
	go func() {
		defer close(done)
		s.RunSudo(context.Background(), []string{"sleep", "3"}, 20*time.Second)
	}()
	time.Sleep(time.Second)
	probe := dialLab(t)
	ps := probe.Run(context.Background(), []string{"sh", "-c", "cat /proc/[0-9]*/cmdline 2>/dev/null | tr '\\0' ' '"}, 10*time.Second)
	<-done
	if !strings.Contains(ps.Stdout.Text, "sleep 3") {
		t.Fatalf("la sonda no ha visto el comando: %q", ps.Stdout.Text)
	}
	if strings.Contains(ps.Stdout.Text, labPassword) {
		t.Fatal("la contraseña aparece en el argv de algún proceso")
	}
}
