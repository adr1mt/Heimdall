#!/usr/bin/env bash
# Acceptance of T072: what the teacher downloads must work on a machine with
# nothing installed. It checks the package that `make gui-dist` built, not the
# development tree.
#
#   P-1  the package carries the engine and it is executable
#   P-2  that engine corrects the lab with the environment emptied: no Go, no
#        Ruby, no gems, no PATH at all
#   P-3  the application starts with a clean data directory and a PATH with no
#        engine on it, and stays up
#
# Needs `make gui-dist` and `make lab`.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
UNPACKED="$ROOT/dist/linux-unpacked"
ENGINE="$UNPACKED/resources/heimdall"
APP="$UNPACKED/heimdall-gui"
PROTO="$REPO/testdata/proto"

# The lab password (test/README.md). Fictitious, public and only valid inside
# the container.
SECRET="TEUTON_SECRET_TEST_12345"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failed=""
ok()   { printf 'OK     %-5s %s\n' "$1" "$2"; }
bad()  { printf 'FALLO  %-5s %s\n' "$1" "$2"; failed="yes"; }
die()  { echo "paquete: $*" >&2; exit 1; }

command -v jq >/dev/null || die "hace falta jq"
[ -x "$APP" ] || die "no hay paquete: ejecuta make gui-dist"

# --- P-1 the engine travels inside -----------------------------------------
if [ -x "$ENGINE" ]; then
  ok P-1 "el paquete lleva el motor y es ejecutable"
else
  bad P-1 "el paquete no lleva un motor ejecutable en resources/"
fi

# --- P-2 it corrects with nothing installed --------------------------------
# `env -i` empties the environment: no PATH, so nothing can be found on the
# system, and no interpreter of any kind is reachable. The verdict must be the
# same one the engine built from source gives, student by student.
verdict() { # verdict <artifact>
  jq -S -c '[.students[] | {student_id, status, score}]' "$1"
}

correct() { # correct <engine> <var-dir> ; prints the artifact path
  printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET" |
    env -i "$1" run --secrets=stdin --var="$2" "$PROTO" >/dev/null 2>&1
  echo "$2/latest.json"
}

inside="$(correct "$ENGINE" "$WORK/var-paquete")"
source_built="$(correct "$REPO/bin/heimdall" "$WORK/var-fuente")"
if [ ! -s "$inside" ]; then
  bad P-2 "el motor del paquete no escribio ningun resultado"
elif [ "$(verdict "$inside")" = "$(verdict "$source_built")" ]; then
  ok P-2 "sin nada instalado, el motor del paquete corrige igual"
else
  bad P-2 "el motor del paquete da otro resultado: $(verdict "$inside")"
fi

# --- P-3 the application starts without a system engine --------------------
# A PATH with only an empty directory: there is no `heimdall` to fall back to,
# so an application that starts is one that found the engine it carries.
EMPTY="$WORK/sin-motor"
mkdir -p "$EMPTY" "$WORK/userdata"
env PATH="$EMPTY" HOME="$WORK" "$APP" --no-sandbox --user-data-dir="$WORK/userdata" \
  >"$WORK/app.txt" 2>&1 &
app=$!
sleep 8
if kill -0 "$app" 2>/dev/null; then
  ok P-3 "la aplicacion arranca sin ningun motor en el PATH"
else
  bad P-3 "la aplicacion no se mantuvo en pie: $(tail -3 "$WORK/app.txt" | tr '\n' ' ')"
fi
kill "$app" 2>/dev/null
wait "$app" 2>/dev/null

[ -z "$failed" ] || exit 1
echo "paquete: todo verde"
