package engine

import (
	"context"
	"sync"
)

// hostGate bounds how many sessions are being opened at the same time against
// one destination machine.
//
// It is the second of the two limits the engine needs (F-05). The worker pool
// bounds how many students are evaluated at once; this bounds how many of them
// are knocking on the same door. OpenSSH refuses connections past
// `MaxStartups` (10 unauthenticated by default) before anyone has typed a
// password, and a refusal there would reach the artifact as UNEVALUATED: the
// engine itself would be producing zeros.
//
// Only the opening is gated. Once a session is authenticated it no longer
// counts against MaxStartups, so commands run without waiting for anybody.
type hostGate struct {
	limit int

	mu    sync.Mutex
	slots map[string]chan struct{}
}

func newHostGate(limit int) *hostGate {
	return &hostGate{limit: limit, slots: map[string]chan struct{}{}}
}

// slot returns the semaphore of one endpoint, created the first time it is
// dialled.
func (g *hostGate) slot(endpoint string) chan struct{} {
	g.mu.Lock()
	defer g.mu.Unlock()
	s, ok := g.slots[endpoint]
	if !ok {
		s = make(chan struct{}, g.limit)
		g.slots[endpoint] = s
	}
	return s
}

// acquire waits for a free slot on that endpoint. It reports false when the
// context ended first, so waiting for a turn is never an infinite wait and
// never hides a cancellation.
func (g *hostGate) acquire(ctx context.Context, endpoint string) bool {
	if g.limit <= 0 {
		return ctx.Err() == nil
	}
	select {
	case g.slot(endpoint) <- struct{}{}:
		return true
	case <-ctx.Done():
		return false
	}
}

func (g *hostGate) release(endpoint string) {
	if g.limit <= 0 {
		return
	}
	select {
	case <-g.slot(endpoint):
	default:
	}
}
