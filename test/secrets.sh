#!/usr/bin/env bash
# Acceptance test for T011: the prototype runs end to end from the command line
# and the password never becomes visible.
#
# It checks what the security rules demand and a Go test cannot: that the
# secret is absent from argv of the live process, from the terminal output and
# from everything under var/.
#
# Needs the lab up (`make lab`). Credentials are fictitious (test/README.md).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/evalon"
PROJECT="$ROOT/testdata/proto"
SECRET="TEUTON_SECRET_TEST_12345"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

fail() { echo "FALLO: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }

[ -x "$BIN" ] || fail "no existe $BIN: ejecuta make build"

# --- 1a. stdin closed with nothing in it aborts at once with exit 2 ----------
"$BIN" run --secrets=stdin --var="$OUT/vacio" "$PROJECT" </dev/null >/dev/null 2>"$OUT/stderr-vacio"
code=$?
[ "$code" -eq 2 ] || fail "stdin cerrado y vacío salió con $code, se esperaba 2"
[ ! -d "$OUT/vacio" ] || fail "stdin cerrado y vacío creó $OUT/vacio"
ok "stdin cerrado y vacío aborta con exit 2 y no escribe nada"

# --- 1b. stdin open with nothing coming aborts at 5 s, not never -------------
mkfifo "$OUT/fifo"
exec 9<>"$OUT/fifo"   # kept open, so the reader never sees EOF
start=$SECONDS
"$BIN" run --secrets=stdin --var="$OUT/colgado" "$PROJECT" \
  <"$OUT/fifo" >/dev/null 2>"$OUT/stderr-colgado"
code=$?
elapsed=$((SECONDS - start))
exec 9>&-
[ "$code" -eq 2 ] || fail "stdin sin datos salió con $code, se esperaba 2"
[ "$elapsed" -ge 4 ] && [ "$elapsed" -le 8 ] \
  || fail "stdin sin datos tardó ${elapsed}s en abortar, se esperaban unos 5"
[ ! -d "$OUT/colgado" ] || fail "stdin sin datos creó $OUT/colgado"
ok "stdin abierto y sin datos aborta con exit 2 a los ${elapsed}s"

# --- 2. a reference without a variable is exit 2, not an empty password ------
env -u AULA_PASSWORD "$BIN" run --secrets=env --var="$OUT/sinvar" "$PROJECT" \
  >/dev/null 2>"$OUT/stderr-sinvar"
code=$?
[ "$code" -eq 2 ] || fail "referencia sin variable salió con $code, se esperaba 2"
grep -q "AULA_PASSWORD" "$OUT/stderr-sinvar" || fail "el error no nombra AULA_PASSWORD"
[ ! -d "$OUT/sinvar" ] || fail "la referencia sin variable creó $OUT/sinvar"
ok "una referencia sin variable es exit 2 y nombra la variable"

# --- 3. the full prototype runs with --secrets=stdin ------------------------
VAR="$OUT/var"
printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET" \
  | "$BIN" run --secrets=stdin --var="$VAR" "$PROJECT" >"$OUT/stdout" 2>"$OUT/stderr" &
pid=$!

# While the process is alive, its argv must not carry the secret.
found_in_argv=0
for _ in $(seq 1 100); do
  kill -0 "$pid" 2>/dev/null || break
  if tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q "$SECRET"; then
    found_in_argv=1
    break
  fi
  sleep 0.1
done
wait "$pid"
code=$?
[ "$found_in_argv" -eq 0 ] || fail "el secreto apareció en /proc/$pid/cmdline"
ok "el secreto no aparece en argv con el proceso vivo"

# The prototype has a student on a closed port, so the run is partial (exit 3).
[ "$code" -eq 3 ] || fail "la ejecución salió con $code, se esperaba 3 (parcial)"
ok "la ejecución completa sale con exit 3 (parcial), como manda el prototipo"

artifact="$(ls "$VAR"/run-*.json 2>/dev/null | grep -v partial | head -1)"
[ -n "$artifact" ] || fail "no se escribió var/run-<id>.json en $VAR"
[ -L "$VAR/latest.json" ] || fail "no se creó latest.json"
[ ! -f "$VAR"/run-*.partial.json ] || fail "quedó un parcial sin borrar"
ok "artefacto en $(basename "$artifact") con latest.json y sin parcial"

# --- 4. zero occurrences of the secret anywhere ------------------------------
if grep -rq "$SECRET" "$VAR"; then
  fail "el secreto aparece bajo $VAR"
fi
if grep -q "$SECRET" "$OUT/stdout" "$OUT/stderr"; then
  fail "el secreto aparece en la salida del terminal"
fi
ok "cero coincidencias del secreto en var/ y en la salida del terminal"

# --- 5. no stack traces in the output ---------------------------------------
if grep -qE "goroutine |\.go:[0-9]+" "$OUT/stdout" "$OUT/stderr" "$OUT"/stderr-*; then
  fail "hay traza de pila en la salida"
fi
ok "ninguna traza de pila en la salida"

echo "test/secrets.sh: todo verde"
