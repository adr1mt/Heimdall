#!/usr/bin/env bash
# End-to-end audit of the classroom password on the engine side (T011, T082).
#
# It checks what the security rules demand and a Go test cannot: that the
# secret is absent from argv of the live process, from the terminal output,
# from everything under var/ and from the event stream, the retry and the
# session round. The interface side of the same audit is
# gui/tests/secretos.test.ts.
#
# Needs the lab up (`make lab`). Credentials are fictitious (test/README.md).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/heimdall"
PROJECT="$ROOT/testdata/proto"
SECRET="HEIMDALL_SECRET_TEST_12345"
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

# --- 6. the event stream and the artifacts of a retry and a session ---------
# The interface reads the run live over NDJSON and then repeats it: three more
# documents the secret could ride on (ADR-0017, ADR-0018, ADR-0020).
printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET" \
  | "$BIN" run --secrets=stdin --events=ndjson --var="$OUT/ev" "$PROJECT" \
    >"$OUT/eventos.ndjson" 2>"$OUT/stderr-ev"
first="$(ls "$OUT"/ev/run-*.json | grep -v partial | head -1)"
[ -n "$first" ] || fail "el run con eventos no escribió artefacto"
[ "$(wc -l <"$OUT/eventos.ndjson")" -gt 0 ] || fail "no se emitió ningún evento"

printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET" \
  | "$BIN" run --secrets=stdin --retry="$first" --var="$OUT/re" "$PROJECT" \
    >"$OUT/stdout-re" 2>"$OUT/stderr-re"
second="$(ls "$OUT"/re/run-*.json | grep -v partial | head -1)"
[ -n "$second" ] || fail "el reintento no escribió artefacto"

printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET" \
  | "$BIN" run --secrets=stdin --session="$first" --session="$second" \
    --var="$OUT/se" "$PROJECT" >"$OUT/stdout-se" 2>"$OUT/stderr-se"
[ -n "$(ls "$OUT"/se/run-*.json 2>/dev/null)" ] || fail "la vuelta de sesión no escribió artefacto"

if grep -rq "$SECRET" "$OUT/ev" "$OUT/re" "$OUT/se" "$OUT/eventos.ndjson" \
  "$OUT/stdout-re" "$OUT/stderr-re" "$OUT/stdout-se" "$OUT/stderr-se" "$OUT/stderr-ev"; then
  fail "el secreto aparece en los eventos o en los artefactos del reintento o de la sesión"
fi
ok "cero coincidencias en los eventos y en los artefactos de reintento y sesión"

echo "test/secrets.sh: todo verde"
