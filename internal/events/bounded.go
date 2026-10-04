package events

import (
	"fmt"
	"io"
	"sync"
	"time"
)

const (
	maxQueuedLines = 256
	maxQueuedBytes = 2 << 20
)

// boundedOutput accepts complete NDJSON lines without waiting for stdout.
// It never creates a goroutine per event and never retains an unbounded queue.
type boundedOutput struct {
	mu       sync.Mutex
	lines    chan []byte
	done     chan struct{}
	bytes    int
	dropped  int
	closed   bool
	writeErr error
	timedOut bool
}

func newBoundedOutput(w io.Writer) *boundedOutput {
	b := &boundedOutput{lines: make(chan []byte, maxQueuedLines), done: make(chan struct{})}
	go func() {
		defer close(b.done)
		for line := range b.lines {
			b.mu.Lock()
			b.bytes -= len(line)
			failed := b.writeErr != nil
			b.mu.Unlock()
			if failed {
				continue
			}
			n, err := w.Write(line)
			if err == nil && n != len(line) {
				err = io.ErrShortWrite
			}
			if err != nil {
				b.mu.Lock()
				b.writeErr = err
				b.mu.Unlock()
			}
		}
	}()
	return b
}

func (b *boundedOutput) Write(line []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return 0, io.ErrClosedPipe
	}
	if b.writeErr != nil || len(b.lines) == cap(b.lines) || b.bytes+len(line) > maxQueuedBytes {
		b.dropped++
		return len(line), nil
	}
	copyLine := append([]byte(nil), line...)
	b.lines <- copyLine
	b.bytes += len(copyLine)
	return len(line), nil
}

func (b *boundedOutput) finish(timeout time.Duration) {
	b.mu.Lock()
	if !b.closed {
		b.closed = true
		close(b.lines)
	}
	b.mu.Unlock()
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-b.done:
	case <-timer.C:
		b.mu.Lock()
		b.timedOut = true
		b.mu.Unlock()
	}
}

func (b *boundedOutput) err() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.writeErr != nil {
		return fmt.Errorf("no se pudo escribir el progreso: %w", b.writeErr)
	}
	if b.dropped > 0 {
		return fmt.Errorf("se perdió parte del progreso (%d eventos omitidos); consulte el resultado guardado", b.dropped)
	}
	if b.timedOut {
		return fmt.Errorf("no se pudo terminar de entregar el progreso; consulte el resultado guardado")
	}
	return nil
}
