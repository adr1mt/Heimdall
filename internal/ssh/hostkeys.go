package ssh

import (
	"fmt"
	"net"
	"sync"

	"golang.org/x/crypto/ssh"
)

// HostKeys remembers the identity every machine presented during one run.
//
// The policy is deliberate (ADR-0011). Students sit their exams on throwaway
// virtual machines: a machine that has never been seen before is the normal
// case, not an alarm, and a key kept from last week would refuse the whole
// class for no reason. So the first sight of a machine is accepted and
// recorded with its fingerprint, and from that moment on it must not change:
// within a run, a machine that answers with a different identity is not the
// machine that was being examined.
//
// What this does not do is pretend to authenticate a machine it has never
// seen. The guarantee it gives is narrower and it is written in the report:
// the fingerprint of every host, so a swap is auditable afterwards.
type HostKeys struct {
	mu   sync.Mutex
	seen map[string]string // address -> fingerprint
}

// NewHostKeys returns an empty registry for one run.
func NewHostKeys() *HostKeys {
	return &HostKeys{seen: map[string]string{}}
}

// check accepts the first identity of an address and refuses a later one.
// The returned bool says whether this was the first sight, so the caller can
// report the fingerprint once per host.
func (h *HostKeys) check(address string, key ssh.PublicKey) (first bool, err error) {
	fp := ssh.FingerprintSHA256(key)

	h.mu.Lock()
	defer h.mu.Unlock()
	if h.seen == nil {
		h.seen = map[string]string{}
	}
	known, ok := h.seen[address]
	if !ok {
		h.seen[address] = fp
		return true, nil
	}
	if known != fp {
		return false, fmt.Errorf(
			"la máquina %s ha respondido con una identidad distinta de la que presentó al principio de esta ejecución (%s en vez de %s)",
			address, fp, known)
	}
	return false, nil
}

// hostKeyCallback checks the identity against the registry and reports the
// fingerprint of each host once.
func hostKeyCallback(keys *HostKeys, address string, warn func(code, message string), refuse func(error)) ssh.HostKeyCallback {
	return func(_ string, _ net.Addr, key ssh.PublicKey) error {
		first, err := keys.check(address, key)
		if err != nil {
			refuse(err)
			return err
		}
		if first {
			warn("HOST_KEY_ACCEPTED", fmt.Sprintf(
				"la identidad de %s se ha aceptado y anotado para esta ejecución: %s",
				address, ssh.FingerprintSHA256(key)))
		}
		return nil
	}
}
