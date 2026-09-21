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
SECRET="HEIMDALL_SECRET_TEST_12345"

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

CSV="$WORK/notas.csv"

PROJECT="$WORK" \
HEIMDALL_ENGINE="$REPO/bin/heimdall" \
LAB_SECRET_FILE="$WORK/clave" \
CSV_OUT="$CSV" \
CHECK_BACKUPS=1 \
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

grep -q "^\[lab-run\] historico: igual$" "$WORK/salida.txt" \
  && ok "H-1" "reabrir la corrección desde el histórico da la misma pantalla" \
  || fail "H-1" "el histórico no enseña lo mismo que el día de la corrección"

# T056: las notas salen de la aplicación, y solo las notas.
if [ -s "$CSV" ] && head -1 "$CSV" | grep -q "alumno;identificador;moodle"; then
  ok "X-1" "las notas se exportan a CSV desde la aplicación"
else
  fail "X-1" "no se ha escrito el fichero de notas"
fi

if [ -s "$CSV" ] && grep -qFf "$PATTERN" "$CSV"; then
  fail "X-2" "contraseña en el fichero de notas"
else
  ok "X-2" "ninguna contraseña en el fichero de notas"
fi

# T113: la copia se hace sola y borrar la carpeta del examen no se lleva las
# notas. La carpeta se borra dentro del arnés y se restaura desde la pantalla.
grep -q "^\[lab-run\] copias: [1-9]" "$WORK/salida.txt" \
  && ok "B-1" "al terminar la corrección hay copia de las notas fuera del examen" \
  || fail "B-1" "no se ha hecho ninguna copia de seguridad"

if grep -q "^\[lab-run\] restaurar: ok$" "$WORK/salida.txt" \
   && sed -n '/----- recuperado -----/,/----------------------/p' "$WORK/salida.txt" \
      | grep -q "de peso total"; then
  ok "B-2" "borrada la carpeta del examen, las notas se recuperan desde la aplicación"
else
  fail "B-2" "las notas no se recuperan tras borrar la carpeta del examen"
fi

if grep -rqFf "$PATTERN" "$USERDATA/copias" 2>/dev/null; then
  fail "B-3" "contraseña en las copias de seguridad"
else
  ok "B-3" "ninguna contraseña viaja en la copia"
fi

[ -z "$failed" ] || { echo; echo "Hay fallos."; exit 1; }
echo; echo "Los secretos no salen de la memoria."
