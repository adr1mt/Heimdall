package report

import (
	"crypto/rand"
	"errors"
	"time"
)

// crockford is the alphabet of a ULID: base32 without I, L, O and U.
const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// NewRunID returns a ULID: 48 bits of millisecond timestamp and 80 bits of
// randomness, in 26 characters. Two runs started in the same millisecond get
// different ids, which is what keeps them from overwriting each other's
// artifact (F-13).
func NewRunID() (string, error) {
	return newRunIDAt(time.Now())
}

func newRunIDAt(t time.Time) (string, error) {
	var entropy [10]byte
	if _, err := rand.Read(entropy[:]); err != nil {
		return "", errors.New("no se pudo generar el identificador de la ejecución: " + err.Error())
	}

	ms := uint64(t.UTC().UnixMilli())
	out := make([]byte, 26)
	// The first 10 characters are the timestamp, most significant first.
	for i := 9; i >= 0; i-- {
		out[i] = crockford[ms&0x1f]
		ms >>= 5
	}
	// The remaining 16 hold the 80 random bits, 5 at a time.
	var bits, n uint32
	j := 10
	for _, b := range entropy {
		bits = bits<<8 | uint32(b)
		n += 8
		for n >= 5 {
			n -= 5
			out[j] = crockford[(bits>>n)&0x1f]
			j++
		}
	}
	return string(out), nil
}
