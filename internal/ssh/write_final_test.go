package ssh

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Exercise the exact fixed remote program locally with a synthetic home.
func TestFinalReportIsPrivateImmutableAndIdempotent(t *testing.T) {
	home := t.TempDir()
	name := "informe-final-test.html"
	write := func(body string) error {
		cmd := exec.Command("sh", "-c", writeFinalHomeScript, "test", name)
		cmd.Env = append(os.Environ(), "HOME="+home)
		cmd.Stdin = strings.NewReader(body)
		return cmd.Run()
	}
	first := "<html>nota 10; $(id) `whoami`</html>"
	if err := write(first); err != nil {
		t.Fatal(err)
	}
	if err := write(first); err != nil {
		t.Fatalf("identical retry: %v", err)
	}
	if err := write("nota 7"); err == nil {
		t.Fatal("overwrote final report")
	}
	path := filepath.Join(home, name)
	data, _ := os.ReadFile(path)
	if string(data) != first {
		t.Fatalf("changed contents: %s", data)
	}
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0600 {
		t.Fatalf("permissions: %o", info.Mode().Perm())
	}
	entries, _ := filepath.Glob(filepath.Join(home, ".heimdall-*"))
	if len(entries) != 0 {
		t.Fatalf("temporary files remain: %v", entries)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(home, "other")
	if err := os.WriteFile(target, []byte(first), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(target, path); err != nil {
		t.Fatal(err)
	}
	if err := write(first); err == nil {
		t.Fatal("accepted a symlink as an existing final report")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path, 0700); err != nil {
		t.Fatal(err)
	}
	if err := write(first); err == nil {
		t.Fatal("accepted a directory")
	}
}
