package ssh

import (
	"io"
	"strings"
	"unicode/utf8"

	"evalon/internal/model"
)

const (
	// keepLimit is how much of one stream ends up in the artifact. 64 kB is
	// plenty to see why a check failed.
	keepLimit = 64 * 1024
	// hardLimit is where the reader stops reading altogether. It protects the
	// run from the accidental `cat` of a 300 MB file.
	hardLimit = 8 * 1024 * 1024
)

// capWriter keeps the first keepLimit bytes of a stream, counts every byte it
// is given, and gives up at hardLimit. The student's output is untrusted data:
// memory use here must not depend on how much the student prints.
type capWriter struct {
	kept     []byte
	total    int64
	overflow bool // the hard limit was hit and reading stopped
}

func (w *capWriter) Write(p []byte) (int, error) {
	w.total += int64(len(p))
	if room := keepLimit - len(w.kept); room > 0 {
		if len(p) < room {
			room = len(p)
		}
		w.kept = append(w.kept, p[:room]...)
	}
	if w.total > hardLimit {
		w.overflow = true
		return len(p), errOverflow
	}
	return len(p), nil
}

// stream renders what was captured. The text is valid UTF-8 and is cut on a
// rune boundary, never in the middle of one.
func (w *capWriter) stream() (model.Stream, bool) {
	kept := w.kept
	for len(kept) > 0 && !utf8.Valid(kept) {
		// Only a trailing partial rune can make an otherwise valid prefix
		// invalid; drop it byte by byte until the boundary is reached.
		if r, size := utf8.DecodeLastRune(kept); r == utf8.RuneError && size <= 1 {
			kept = kept[:len(kept)-1]
			continue
		}
		break
	}
	text := string(kept)
	sanitised := !utf8.ValidString(text)
	if sanitised {
		text = strings.ToValidUTF8(text, "�")
	}
	return model.Stream{
		Text:       text,
		Bytes:      int64(len(kept)),
		BytesTotal: w.total,
		Truncated:  w.total > int64(len(kept)),
	}, sanitised
}

// drain copies r into w until EOF or until w gives up.
func drain(w *capWriter, r io.Reader) {
	buf := make([]byte, 32*1024)
	for {
		n, err := r.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
		}
		if err != nil {
			return
		}
	}
}
