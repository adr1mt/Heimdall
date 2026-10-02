package ssh

import (
	"bytes"
	"io"
	"strconv"
	"strings"
	"unicode/utf8"

	"heimdall/internal/model"
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
	tail     []byte
	total    int64
	overflow bool // the hard limit was hit and reading stopped
}

func (w *capWriter) Write(p []byte) (int, error) {
	w.total += int64(len(p))
	const tailLimit = 512
	if len(p) >= tailLimit {
		w.tail = append(w.tail[:0], p[len(p)-tailLimit:]...)
	} else {
		if len(w.tail)+len(p) > tailLimit {
			w.tail = w.tail[len(w.tail)+len(p)-tailLimit:]
		}
		w.tail = append(w.tail, p...)
	}
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

// completion consumes the private trailing control record without exposing it
// as student evidence, including when stderr's evidence prefix was truncated.
func (w *capWriter) completion(marker string) (int, bool) {
	if marker == "" || len(w.tail) == 0 || w.tail[len(w.tail)-1] != 0x1f {
		return 0, false
	}
	at := bytes.LastIndex(w.tail, []byte(marker))
	if at < 0 {
		return 0, false
	}
	code, err := strconv.Atoi(string(w.tail[at+len(marker) : len(w.tail)-1]))
	if err != nil || code < 0 || code > 255 {
		return 0, false
	}
	w.total -= int64(len(w.tail) - at)
	if int64(len(w.kept)) > w.total {
		w.kept = w.kept[:int(w.total)]
	}
	return code, true
}
