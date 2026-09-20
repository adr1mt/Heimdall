#!/usr/bin/env bash
# The fourth acceptance criterion of T052: correcting from the application must
# not leave a password anywhere. It runs a real correction through the built
# app and looks for the secret in the three places it could leak to:
#
#   1. argv of every process alive during the run (`ps` shows it to anyone),
#   2. the environment of those processes,
#   3. everything the application wrote in its own data directory.
#
# The password is the lab's: fictitious, public and only valid in the container.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
SECRET="TEUTON_SECRET_TEST_12345"

# npm runs from the GUI tree whatever directory the script was called from.
cd "$ROOT"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp "$REPO/testdata/proto/examen.yaml" "$REPO/testdata/proto/aula.yaml" "$WORK/"

USERDATA="$WORK/userdata"
failed=""
ok()   { printf 'OK     %-5s %s\n' "$1" "$2"; }
fail() { printf 'FALLO  %-5s %s\n' "$1" "$2"; failed="yes"; }

# The password reaches the harness in a file it deletes on reading. An
# environment variable would put it in the environ of npm and of electron, and
# this check would then be finding the harness's leak and not the app's.
printf '%s' "$SECRET" >"$WORK/clave"
chmod 600 "$WORK/clave"

# Every search below reads the pattern from a file: `grep -F "$SECRET"` would
# put the password in grep's own argv, and the scan would keep finding itself.
PATTERN="$WORK/patron"
printf '%s\n' "$SECRET" >"$PATTERN"

PROJECT="$WORK" \
HEIMDALL_ENGINE="$REPO/bin/heimdall" \
LAB_SECRET_FILE="$WORK/clave" \
  npm run --silent lab-run -- --user-data-dir="$USERDATA" >"$WORK/salida.txt" 2>&1 &
app=$!

# While it runs, look at every process on the machine. argv and environ are
# readable by any user, which is exactly why neither may carry the password.
argv_hit=""
env_hit=""
for _ in $(seq 60); do
  sleep 0.2
  kill -0 "$app" 2>/dev/null || break
  for cmdline in /proc/[0-9]*/cmdline; do
    cat "$cmdline" 2>/dev/null | tr '\0' ' ' | grep -qFf "$PATTERN" && argv_hit="$cmdline"
  done
  for environ in /proc/[0-9]*/environ; do
    cat "$environ" 2>/dev/null | tr '\0' '\n' | grep -qFf "$PATTERN" && env_hit="$environ"
  done
done
wait "$app"

grep -q "de peso total" "$WORK/salida.txt" \
  && ok "S-0" "la corrección del laboratorio ha llegado hasta el final" \
  || fail "S-0" "la corrección no ha terminado; el resto de la prueba no vale"

[ -z "$argv_hit" ] && ok "S-1" "ninguna contraseña en argv de ningún proceso" \
                   || fail "S-1" "contraseña en $argv_hit"
[ -z "$env_hit" ]  && ok "S-2" "ninguna contraseña en el entorno de ningún proceso" \
                   || fail "S-2" "contraseña en $env_hit"

if grep -rqFf "$PATTERN" "$USERDATA" 2>/dev/null; then
  fail "S-3" "contraseña en los ficheros de la aplicación: $(grep -rlFf "$PATTERN" "$USERDATA" | head -1)"
else
  ok "S-3" "ninguna contraseña en los ficheros de la aplicación"
fi

if grep -qFf "$PATTERN" "$WORK/salida.txt"; then
  fail "S-4" "contraseña en la salida de la aplicación"
else
  ok "S-4" "ninguna contraseña en la salida de la aplicación"
fi

[ -z "$failed" ] || { echo; echo "Hay fallos."; exit 1; }
echo; echo "Los secretos no salen de la memoria."
