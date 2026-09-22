#!/usr/bin/env bash
# One version for the whole product (T083).
#
# The number lives in VERSION at the root. The engine is stamped with it by
# `make build`; the application carries it in its package.json, because that is
# what electron-builder names the package with. Two places, one number: this
# checks they have not drifted apart, and that the binary in bin/ is a stamped
# build and not a stray `go build`.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/heimdall"

fail() { echo "FALLO: $*" >&2; exit 1; }

WANT="$(tr -d '[:space:]' < "$ROOT/VERSION")"
[ -n "$WANT" ] || fail "VERSION está vacío"

[ -x "$BIN" ] || fail "no existe $BIN: ejecuta make build"
GOT="$("$BIN" version | awk '{print $2}')"
[ "$GOT" = "$WANT" ] \
  || fail "el motor dice $GOT y VERSION dice $WANT (¿un go build sin make?)"

GUI="$(grep -m1 '"version"' "$ROOT/gui/package.json" | sed 's/.*: *"\(.*\)".*/\1/')"
[ "$GUI" = "$WANT" ] || fail "la aplicación dice $GUI y VERSION dice $WANT"

echo "ok: motor, aplicación y VERSION dicen $WANT"
