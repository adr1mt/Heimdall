#!/usr/bin/env bash
# Acceptance criteria A-1 to A-14 of the vertical slice
# (docs/design/07-PROTOTIPO.md §6), checked with jq over real artifacts and
# with /usr/bin/time. Nothing here is judged by eye.
#
# One line per criterion, OK or FALLO, and a non-zero exit if any fails.
# A-1, A-2, A-3, A-8 and A-14 are the ones that protect the integrity of the
# grade: if one of those fails, the milestone is not met.
#
# Needs the lab up (`make lab`) and the binary built (`make build`).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/heimdall"
PROTO="$ROOT/testdata/proto"
BIG="$ROOT/testdata/salida-grande"
BADKEY="$ROOT/testdata/clave-desconocida"

# The lab password (test/README.md). Fictitious, public and only valid inside
# the container. A-7 demands zero occurrences of it anywhere.
SECRET="TEUTON_SECRET_TEST_12345"
SECRETS_LINE="$(printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET")"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

BLOCKING="A-1 A-2 A-3 A-8 A-14"
failed=""
blocking_failed=""

ok()   { printf 'OK     %-5s %s\n' "$1" "$2"; }
bad()  {
  printf 'FALLO  %-5s %s\n' "$1" "$2"
  failed="$failed $1"
  case " $BLOCKING " in *" $1 "*) blocking_failed="$blocking_failed $1";; esac
}
skip() { printf 'PEND   %-5s %s\n' "$1" "$2"; }
die()  { echo "acceptance: $*" >&2; exit 1; }

# check <id> <description> <condition-output> compares a computed value.
expect() { # expect <id> <description> <got> <want>
  if [ "$3" = "$4" ]; then ok "$1" "$2"; else bad "$1" "$2: obtenido $3, se esperaba $4"; fi
}

command -v jq >/dev/null || die "hace falta jq"
[ -x /usr/bin/time ] || die "hace falta /usr/bin/time"
[ -x "$BIN" ] || die "no existe $BIN: ejecuta make build"
"$ROOT/test/lab.sh" status >/dev/null || die "el laboratorio no está levantado: ejecuta make lab"

# --------------------------------------------------------------------------
# The run every criterion below is measured on. Spanish locale on purpose:
# A-12 repeats it under LC_ALL=C and compares the grades.
# --------------------------------------------------------------------------
VAR1="$WORK/var1"
printf '%s' "$SECRETS_LINE" | LANG=es_ES.UTF-8 /usr/bin/time -v -o "$WORK/time1" \
  "$BIN" run --secrets=stdin --var="$VAR1" "$PROTO" >"$WORK/out1" 2>"$WORK/err1"
EXIT1=$?
ART1="$(ls "$VAR1"/run-*.json 2>/dev/null | grep -v partial | head -1)"
[ -n "$ART1" ] || die "la ejecución no dejó artefacto (exit $EXIT1): $(cat "$WORK/err1")"
jq -e . "$ART1" >/dev/null || die "el artefacto no es JSON válido"

q() { jq -r "$1" "$ART1"; }

# --- A-1 the same PLAN for both students ----------------------------------
expect A-1 "los dos alumnos reciben las mismas 5 comprobaciones" \
  "$(q '[.students[].checks | length] | unique | tostring')" '[5]'
expect A-1 "los dos alumnos se miden sobre el mismo peso total" \
  "$(q '[.students[].score.total] | unique | tostring')" '[6]'
expect A-1 "los dos alumnos reciben la misma lista de comprobaciones" \
  "$(q '[.students[] | [.checks[].check_id]] | unique | length')" '1'

# --- A-2 a technical failure is never FAIL --------------------------------
expect A-2 "ninguna causa técnica produce un suspenso" \
  "$(q '[.students[].checks[] | select(.cause != "NONE") | .status] | unique - ["UNEVALUATED"] | tostring')" '[]'

# --- A-3 incomplete means no final grade ----------------------------------
expect A-3 "con algo sin evaluar no hay nota final" \
  "$(q '[.students[] | select(.score.unevaluated > 0) | .score.final_score] | unique | tostring')" '[null]'
expect A-3 "con algo sin evaluar la nota está INCOMPLETE o NOT_EVALUATED" \
  "$(q '[.students[] | select(.score.unevaluated > 0) | .score.status] | unique - ["INCOMPLETE","NOT_EVALUATED"] | tostring')" '[]'

# --- A-4 one student cannot cost the others -------------------------------
expect A-4 "el alumno con la máquina accesible tiene 3 o más comprobaciones evaluadas" \
  "$(q '[.students[] | select(.student_id=="alumne01") | .checks[] | select(.cause=="NONE")] | length >= 3')" 'true'
expect A-4 "el alumno del puerto cerrado sale entero con CONNECT_FAILED" \
  "$(q '[.students[] | select(.student_id=="alumne02") | .checks[].cause] | unique | tostring')" '["CONNECT_FAILED"]'
expect A-4 "el artefacto contiene a los dos alumnos" "$(q '.students | length')" '2'
expect A-4 "la ejecución parcial sale con exit 3, no con 1" "$EXIT1" '3'

# --- A-5 nothing blocks the run -------------------------------------------
WALL="$(awk -F': ' '/Elapsed \(wall clock\)/ {print $2}' "$WORK/time1")"
WALL_S="$(awk -F': ' '/Elapsed \(wall clock\)/ {split($2,a,":"); print int(a[length(a)-1]*60 + a[length(a)])}' "$WORK/time1")"
if [ "${WALL_S:-999}" -lt 90 ]; then
  ok A-5 "el run completo termina en $WALL (< 90 s) con un sleep 30 y un host inalcanzable dentro"
else
  bad A-5 "el run completo tardó $WALL, se esperaba menos de 90 s"
fi
D5="$(q '.students[] | select(.student_id=="alumne01") | .checks[] | select(.check_id=="p5-lento") | .execution.duration_ms')"
expect A-5 "la comprobación lenta corta a su timeout (${D5} ms entre 3000 y 5000)" \
  "$([ "$D5" -ge 3000 ] && [ "$D5" -le 5000 ] && echo true || echo false)" 'true'
expect A-5 "la comprobación lenta sale UNEVALUATED por TIMEOUT" \
  "$(q '.students[] | select(.student_id=="alumne01") | .checks[] | select(.check_id=="p5-lento") | .status + "/" + .cause')" 'UNEVALUATED/TIMEOUT'

# --- A-7 no secret anywhere ------------------------------------------------
LEAKS=0
grep -rq "$SECRET" "$VAR1" && LEAKS=1
grep -q "$SECRET" "$WORK/out1" "$WORK/err1" && LEAKS=1
expect A-7 "el secreto no aparece en var/ ni en la salida del terminal" "$LEAKS" '0'
# argv of the live process: checked by test/secrets.sh, repeated here because
# A-7 demands it with the process alive.
printf '%s' "$SECRETS_LINE" | "$BIN" run --secrets=stdin --var="$WORK/var-argv" "$PROTO" >/dev/null 2>&1 &
pid=$!
ARGV_LEAK=0
for _ in $(seq 1 100); do
  kill -0 "$pid" 2>/dev/null || break
  tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q "$SECRET" && { ARGV_LEAK=1; break; }
  sleep 0.1
done
wait "$pid"
expect A-7 "el secreto no aparece en /proc/<pid>/cmdline con el proceso vivo" "$ARGV_LEAK" '0'

# --- A-8 the JSON explains every single result ----------------------------
expect A-8 "toda comprobación evaluada trae aserción y código de salida" \
  "$(q '[.students[].checks[] | select(.status != "UNEVALUATED") | select(.assertion == null or .execution == null or .execution.exit_code == null)] | length')" '0'
expect A-8 "toda comprobación sin evaluar trae causa y explicación" \
  "$(q '[.students[].checks[] | select(.status == "UNEVALUATED") | select(.cause == "NONE" or (.detail // "") == "")] | length')" '0'

# --- A-11 127.1.2.3 goes over SSH, to the container -----------------------
expect A-11 "el transporte es ssh, no ejecución local" \
  "$(q '[.students[].checks[] | select(.execution != null) | .execution.transport] | unique | tostring')" '["ssh"]'
expect A-11 "el hostname devuelto es el del contenedor" \
  "$(q '.students[] | select(.student_id=="alumne01") | .checks[] | select(.check_id=="p1-hostname") | .execution.stdout.text | rtrimstr("\n")')" 'alu1'

# --- A-14 a technical-looking failure that is academic ---------------------
expect A-14 "el comando inexistente suspende, no avería" \
  "$(q '.students[] | select(.student_id=="alumne01") | .checks[] | select(.check_id=="p4-ausente") | .status + "/" + .cause + "/" + (.execution.exit_code|tostring)')" 'FAIL/NONE/127'

# --- A-6 300 MB of output does not grow the engine ------------------------
VAR6="$WORK/var6"
printf '%s' "$SECRETS_LINE" | /usr/bin/time -v -o "$WORK/time6" \
  "$BIN" run --secrets=stdin --var="$VAR6" "$BIG" >/dev/null 2>"$WORK/err6"
ART6="$(ls "$VAR6"/run-*.json 2>/dev/null | grep -v partial | head -1)"
if [ -z "$ART6" ]; then
  bad A-6 "la ejecución de salida grande no dejó artefacto: $(cat "$WORK/err6")"
else
  q6() { jq -r "$1" "$ART6"; }
  expect A-6 "la salida enorme queda marcada como truncada" \
    "$(q6 '.students[0].checks[0].execution.stdout.truncated')" 'true'
  expect A-6 "se conservan 64 kB como máximo" \
    "$(q6 '.students[0].checks[0].execution.stdout.bytes <= 65536')" 'true'
  expect A-6 "se contabiliza todo lo que produjo el comando" \
    "$(q6 '.students[0].checks[0].execution.stdout.bytes_total > 65536')" 'true'
  expect A-6 "el motivo nombra el desbordamiento, no una conexión perdida" \
    "$(q6 '.students[0].checks[0].status + "/" + .students[0].checks[0].cause')" 'UNEVALUATED/OUTPUT_OVERFLOW'
  expect A-6 "nadie suspende por una salida enorme" \
    "$(q6 '.students[0].score.final_score == null and .students[0].score.status == "NOT_EVALUATED"')" 'true'
  RSS6="$(awk -F': ' '/Maximum resident set size/ {print $2}' "$WORK/time6")"
  if [ "${RSS6:-999999}" -lt 102400 ]; then
    ok A-6 "la memoria del motor se queda en $((RSS6 / 1024)) MB (< 100 MB)"
  else
    bad A-6 "la memoria del motor llegó a $((RSS6 / 1024)) MB, se esperaba menos de 100 MB"
  fi
fi

# --- A-9 a killed run still leaves usable evidence ------------------------
VAR9="$WORK/var9"
printf '%s' "$SECRETS_LINE" | "$BIN" run --secrets=stdin --var="$VAR9" "$PROTO" >/dev/null 2>&1 &
pid=$!
for _ in $(seq 1 200); do
  ls "$VAR9"/run-*.partial.json >/dev/null 2>&1 && break
  kill -0 "$pid" 2>/dev/null || break
  sleep 0.1
done
kill -9 "$pid" 2>/dev/null
wait "$pid" 2>/dev/null
PART="$(ls "$VAR9"/run-*.partial.json 2>/dev/null | head -1)"
if [ -z "$PART" ]; then
  bad A-9 "un SIGKILL a media no dejó parcial en var/"
elif ! jq -e . "$PART" >/dev/null 2>&1; then
  bad A-9 "el parcial no es JSON válido"
else
  expect A-9 "el parcial de un run matado trae al menos un alumno terminado" \
    "$(jq '[.students[] | select(.status != "")] | length >= 1' "$PART")" 'true'
fi

# --- A-10 legacy artifacts: pending, belongs to T040 ----------------------
skip A-10 "artefactos legacy (resume.json, case-NN.json): los escribe T040, fuera de la fase 1"

# --- A-12 the grade does not depend on the locale -------------------------
VAR12="$WORK/var12"
printf '%s' "$SECRETS_LINE" | LC_ALL=C "$BIN" run --secrets=stdin --var="$VAR12" "$PROTO" >/dev/null 2>&1
ART12="$(ls "$VAR12"/run-*.json 2>/dev/null | grep -v partial | head -1)"
if [ -z "$ART12" ]; then
  bad A-12 "la ejecución bajo LC_ALL=C no dejó artefacto"
else
  SCORES="[.students[] | {id: .student_id, score: .score, checks: [.checks[] | {check_id, status, cause}]}]"
  if diff <(jq -S "$SCORES" "$ART1") <(jq -S "$SCORES" "$ART12") >"$WORK/diff12"; then
    ok A-12 "el mismo examen bajo es_ES.UTF-8 y bajo LC_ALL=C da notas idénticas"
  else
    bad A-12 "las notas cambian con el idioma del sistema: $(head -5 "$WORK/diff12" | tr '\n' ' ')"
  fi
fi

# --- A-13 a malformed YAML runs nothing -----------------------------------
# The container's sshd logs every connection attempt, so its log length before
# and after is the evidence that no machine was touched.
VAR13="$WORK/var13"
LOG_BEFORE="$(podman logs alu1 2>&1 | wc -l)"
"$BIN" run --secrets=env --var="$VAR13" "$BADKEY" >"$WORK/out13" 2>"$WORK/err13"
EXIT13=$?
LOG_AFTER="$(podman logs alu1 2>&1 | wc -l)"
expect A-13 "una clave desconocida sale con exit 2" "$EXIT13" '2'
expect A-13 "el error dice el fichero y la línea" \
  "$(grep -cE 'examen\.yaml:[0-9]+' "$WORK/err13")" '1'
expect A-13 "una clave desconocida no crea nada en var/" \
  "$([ -d "$VAR13" ] && echo existe || echo vacio)" 'vacio'
expect A-13 "una clave desconocida no abre ninguna conexión al contenedor" \
  "$LOG_AFTER" "$LOG_BEFORE"

# --------------------------------------------------------------------------
echo
if [ -n "$blocking_failed" ]; then
  echo "acceptance: FALLAN CRITERIOS BLOQUEANTES:$blocking_failed"
  echo "acceptance: el hito no se cumple. No se sigue adelante."
  exit 1
fi
if [ -n "$failed" ]; then
  echo "acceptance: fallan criterios:$failed"
  exit 1
fi
echo "acceptance: los 13 criterios de la fase 1 en verde (A-10 pendiente de T040)"
