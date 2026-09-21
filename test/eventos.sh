#!/usr/bin/env bash
# Acceptance of the native engine <-> GUI contract (T050, ADR-0017).
#
# This script IS the test consumer: it reads a whole run with nothing but the
# event stream and the artifact the stream points at. Anything it cannot find
# out here, the GUI will not be able to find out either.
#
# One line per criterion, OK or FALLO, and a non-zero exit if any fails.
# Needs the lab up (`make lab`) and the binary built (`make build`).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/heimdall"
PROTO="$ROOT/testdata/proto"

# The lab password (test/README.md). Fictitious, public and only valid inside
# the container. E-8 demands zero occurrences of it in the stream.
SECRET="HEIMDALL_SECRET_TEST_12345"
SECRETS_LINE="$(printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET")"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failed=""
ok()  { printf 'OK     %-5s %s\n' "$1" "$2"; }
bad() { printf 'FALLO  %-5s %s\n' "$1" "$2"; failed="$failed $1"; }
die() { echo "eventos: $*" >&2; exit 1; }
expect() { # expect <id> <description> <got> <want>
  if [ "$3" = "$4" ]; then ok "$1" "$2"; else bad "$1" "$2: obtenido $3, se esperaba $4"; fi
}

command -v jq >/dev/null || die "hace falta jq"
[ -x "$BIN" ] || die "no existe $BIN: ejecuta make build"
"$ROOT/test/lab.sh" status >/dev/null || die "el laboratorio no está levantado: ejecuta make lab"

# --------------------------------------------------------------------------
# One run, read only through the contract.
# --------------------------------------------------------------------------
VAR="$WORK/var"
EV="$WORK/eventos.ndjson"
printf '%s' "$SECRETS_LINE" | "$BIN" run --secrets=stdin --events=ndjson --var="$VAR" "$PROTO" >"$EV" 2>"$WORK/err"
CODE=$?

[ -s "$EV" ] || die "la ejecución no emitió ningún evento (exit $CODE): $(cat "$WORK/err")"
while read -r line; do
  printf '%s' "$line" | jq -e . >/dev/null 2>&1 || die "una línea del flujo no es JSON: $line"
done <"$EV"

ev() { jq -c "select(.event == \"$1\")" "$EV"; }
START="$(ev run.start)"
END="$(ev run.end)"

# --- E-1 the first line declares the contract -----------------------------
expect E-1 "la primera línea es run.start con su versión de contrato" \
  "$(head -1 "$EV" | jq -r '"\(.event) \(.contract_version)"')" "run.start 1"

# --- E-2 the denominator of the PLAN travels before any machine -----------
PLAN_CHECKS="$("$BIN" check "$PROTO" | sed -n 's/^Comprobaciones: *//p')"
expect E-2 "run.start publica el denominador exacto del PLAN" \
  "$(printf '%s' "$START" | jq -r '.plan.check_count')" "$PLAN_CHECKS"

# --- E-3 the progress total is exact, not an estimate ---------------------
EXPECTED="$(printf '%s' "$START" | jq -r '.expected_checks')"
EMITTED="$(ev check.end | wc -l)"
expect E-3 "se emite una comprobación por cada una anunciada" "$EMITTED" "$EXPECTED"

# --- E-4 seq is monotonic from 1, so a lost line is visible ---------------
SEQ_OK="$(jq -s 'to_entries | all(.value.seq == .key + 1)' "$EV")"
expect E-4 "los eventos van numerados sin saltos" "$SEQ_OK" "true"

# --- E-5 the stream says the same as the artifact, check by check ---------
ART="$(printf '%s' "$END" | jq -r '.artifact')"
[ -f "$ART" ] || die "run.end no apunta a un artefacto legible: $ART"
FROM_STREAM="$(ev check.end | jq -s -c '[.[] | {student: .student_id, check: .check_id, status, cause}] | sort_by(.student, .check)')"
FROM_ART="$(jq -c '[.students[] | select(.status != "EXCLUDED") | .student_id as $s | .checks[] | {student: $s, check: .check_id, status, cause}] | sort_by(.student, .check)' "$ART")"
if [ "$FROM_STREAM" = "$FROM_ART" ]; then
  ok E-5 "cada comprobación llega al flujo con el mismo estado y la misma causa que al artefacto"
else
  bad E-5 "el flujo y el artefacto no dicen lo mismo"
fi

# --- E-6 a technical failure travels as such, with its cause --------------
UNEVAL="$(ev check.end | jq -s '[.[] | select(.status == "UNEVALUATED")] | length')"
UNEVAL_WITH_CAUSE="$(ev check.end | jq -s '[.[] | select(.status == "UNEVALUATED" and .cause != "NONE" and (.detail // "") != "")] | length')"
if [ "$UNEVAL" -eq 0 ]; then
  bad E-6 "el prototipo debería traer alguna comprobación sin evaluar (alumne02)"
else
  expect E-6 "toda comprobación sin evaluar viaja con su causa técnica y su detalle" "$UNEVAL_WITH_CAUSE" "$UNEVAL"
fi

# --- E-7 the grade never travels as a zero that means "we could not look" -
BROKEN="$(ev student.end | jq -s -c '[.[] | select(.student_id == "alumne02")][0]')"
expect E-7 "un alumno con la máquina apagada no publica nota final" \
  "$(printf '%s' "$BROKEN" | jq -r '"\(.score.status) \(.score.final_score)"')" "NOT_EVALUATED null"

# --- E-8 no secret and no unbounded output on the channel -----------------
HITS="$(grep -c "$SECRET" "$EV")"
LONGEST="$(awk '{ if (length($0) > m) m = length($0) } END { print m+0 }' "$EV")"
if [ "$HITS" -ne 0 ]; then
  bad E-8 "la contraseña aparece $HITS veces en el flujo"
elif [ "$LONGEST" -gt 8192 ]; then
  bad E-8 "hay una línea de $LONGEST bytes: el flujo debe ir acotado"
else
  ok E-8 "ni contraseñas ni salida sin acotar en el flujo"
fi

# --- E-9 the last line closes the run with the truth ----------------------
expect E-9 "run.end coincide con el artefacto y con el código de salida" \
  "$(printf '%s' "$END" | jq -r '"\(.status) \(.exit_code)"')" \
  "$(jq -r '.status' "$ART") $CODE"

# --------------------------------------------------------------------------
# E-10 a cancelled run still closes the stream. A consumer that never sees
# run.end must treat the run as unfinished, so it has to arrive.
# --------------------------------------------------------------------------
VARC="$WORK/varc"
EVC="$WORK/cancelado.ndjson"
printf '%s' "$SECRETS_LINE" | "$BIN" run --secrets=stdin --events=ndjson --var="$VARC" "$PROTO" >"$EVC" 2>/dev/null &
pid=$!
for _ in $(seq 1 200); do
  grep -q '"event":"check.end"' "$EVC" 2>/dev/null && break
  kill -0 "$pid" 2>/dev/null || break
  sleep 0.1
done
kill -INT "$pid" 2>/dev/null
wait "$pid" 2>/dev/null
CCODE=$?
CEND="$(jq -c 'select(.event == "run.end")' "$EVC" 2>/dev/null)"
if [ -z "$CEND" ]; then
  bad E-10 "una ejecución cancelada no cerró el flujo"
else
  expect E-10 "una ejecución cancelada cierra el flujo con su estado real" \
    "$(printf '%s' "$CEND" | jq -r '"\(.status) \(.exit_code)"')" "CANCELLED $CCODE"
fi

echo
if [ -n "$failed" ]; then
  echo "eventos: fallan:$failed"
  exit 1
fi
echo "eventos: el contrato nativo pasa sus criterios"
