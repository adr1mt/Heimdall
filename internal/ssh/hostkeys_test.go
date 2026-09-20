package ssh

import (
	"crypto/ed25519"
	"strings"
	"testing"

	"golang.org/x/crypto/ssh"
)

// testKey builds a public key without touching the network, so the policy is
// tested as pure logic.
func testKey(t *testing.T, seed byte) ssh.PublicKey {
	t.Helper()
	raw := make([]byte, ed25519.PublicKeySize)
	for i := range raw {
		raw[i] = seed
	}
	key, err := ssh.NewPublicKey(ed25519.PublicKey(raw))
	if err != nil {
		t.Fatalf("NewPublicKey: %v", err)
	}
	return key
}

func TestFirstIdentityIsAccepted(t *testing.T) {
	keys := NewHostKeys()

	first, err := keys.check("10.0.0.1:22", testKey(t, 1))
	if err != nil {
		t.Fatalf("la primera identidad fue rechazada: %v", err)
	}
	if !first {
		t.Error("no se anunció como primera vez, y el profesor debe verla en el informe")
	}
}

func TestTheSameIdentityIsNotAnnouncedTwice(t *testing.T) {
	keys := NewHostKeys()
	key := testKey(t, 1)

	if _, err := keys.check("10.0.0.1:22", key); err != nil {
		t.Fatalf("primera: %v", err)
	}
	first, err := keys.check("10.0.0.1:22", key)
	if err != nil {
		t.Fatalf("segunda: %v", err)
	}
	if first {
		t.Error("la misma máquina se anunció dos veces")
	}
}

// The whole point of the registry: within one run, a machine does not get to
// become another machine.
func TestAChangedIdentityIsRefused(t *testing.T) {
	keys := NewHostKeys()

	if _, err := keys.check("10.0.0.1:22", testKey(t, 1)); err != nil {
		t.Fatalf("primera: %v", err)
	}
	_, err := keys.check("10.0.0.1:22", testKey(t, 2))
	if err == nil {
		t.Fatal("se aceptó una identidad distinta para la misma dirección")
	}
	// The teacher reads this sentence: it has to name the machine and say
	// what happened, with no jargon and no stack trace.
	for _, part := range []string{"10.0.0.1:22", "identidad distinta"} {
		if !strings.Contains(err.Error(), part) {
			t.Errorf("el mensaje %q no menciona %q", err, part)
		}
	}
}

// Two different machines are two different registrations: one student's VM
// says nothing about another's.
func TestEachAddressIsIndependent(t *testing.T) {
	keys := NewHostKeys()

	if _, err := keys.check("10.0.0.1:22", testKey(t, 1)); err != nil {
		t.Fatalf("host A: %v", err)
	}
	first, err := keys.check("10.0.0.2:22", testKey(t, 2))
	if err != nil {
		t.Fatalf("host B: %v", err)
	}
	if !first {
		t.Error("la segunda máquina no se anunció como nueva")
	}
}
