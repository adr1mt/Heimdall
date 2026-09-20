package ssh

import (
	"strings"
	"testing"
)

func TestCapWriterKeepsTheFirst64kAndCountsEverything(t *testing.T) {
	var w capWriter
	chunk := strings.Repeat("a", 4096)
	for i := 0; i < 100; i++ { // 400 kB
		w.Write([]byte(chunk))
	}
	s, _ := w.stream()
	if s.Bytes != keepLimit {
		t.Errorf("bytes = %d, want %d", s.Bytes, keepLimit)
	}
	if s.BytesTotal != 100*4096 {
		t.Errorf("bytes_total = %d, want %d", s.BytesTotal, 100*4096)
	}
	if !s.Truncated {
		t.Error("truncated = false, want true: the teacher must know output was dropped")
	}
	if w.overflow {
		t.Error("overflow = true below the hard limit")
	}
}

func TestCapWriterStopsAtTheHardLimit(t *testing.T) {
	var w capWriter
	chunk := make([]byte, 64*1024)
	var err error
	for i := 0; i < 200 && err == nil; i++ { // would be 12 MB
		_, err = w.Write(chunk)
	}
	if err != errOverflow {
		t.Fatalf("err = %v, want errOverflow", err)
	}
	if !w.overflow {
		t.Error("overflow = false after the hard limit")
	}
	if w.total > hardLimit+int64(len(chunk)) {
		t.Errorf("kept reading past the hard limit: %d bytes", w.total)
	}
}

func TestCapWriterCutsOnARuneBoundary(t *testing.T) {
	var w capWriter
	// Fill to one byte short of the limit, then write a 3-byte rune that can
	// only fit partially.
	w.Write([]byte(strings.Repeat("a", keepLimit-1)))
	w.Write([]byte("€"))
	s, sanitised := w.stream()
	if sanitised {
		t.Error("sanitised = true: a partial trailing rune must be dropped, not replaced")
	}
	if s.Bytes != keepLimit-1 {
		t.Errorf("bytes = %d, want %d: the partial rune must be dropped", s.Bytes, keepLimit-1)
	}
	if !s.Truncated {
		t.Error("truncated = false, want true")
	}
}

func TestCapWriterSanitisesInvalidUTF8(t *testing.T) {
	var w capWriter
	w.Write([]byte{'o', 'k', 0xff, 0xfe, '!'})
	s, sanitised := w.stream()
	if !sanitised {
		t.Fatal("sanitised = false on invalid UTF-8")
	}
	if !strings.HasPrefix(s.Text, "ok") || !strings.HasSuffix(s.Text, "!") {
		t.Errorf("text = %q, want the valid bytes kept around the replacement", s.Text)
	}
}
