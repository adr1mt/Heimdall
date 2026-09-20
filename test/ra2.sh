#!/usr/bin/env bash
# T022: the real RA2 exam (16 checks, KEA + BIND) run end to end against the
# lab, and every result explained from the artifact alone.
#
# Two machines: alumne01 hands in a complete exercise, alumne02 hands in one
# with four mistakes and the DNS server stopped. The expected outcome is
# written down here, so a change in the engine that moves a grade fails.
#
# Needs test/ra2/lab.sh up and the binary built (make build).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/heimdall"
EXAM="$ROOT/testdata/ra2"

# Lab password: fictitious, public, only valid inside the container.
SECRET="HEIMDALL_SECRET_RA2_TEST"
SECRETS_LINE="$(printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET")"

# What alumne02 got wrong: gateway handed out by KEA, the blog alias, the TXT
# record, the reverse entry of servidorweb, and named not running.
FAILED02="dns-activo dns-alias dns-inversa-servidorweb dns-texto kea-puerta-enlace"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failed=""
ok()  { printf 'OK     %-24s %s\n' "$1" "$2"; }
bad() { printf 'FALLO  %-24s %s\n' "$1" "$2"; failed="$failed $1"; }
die() { echo "ra2: $*" >&2; exit 1; }
expect() { if [ "$3" = "$4" ]; then ok "$1" "$2"; else bad "$1" "$2: obtenido «$3», se esperaba «$4»"; fi; }

command -v jq >/dev/null || die "hace falta jq"
[ -x "$BIN" ] || die "no existe $BIN: ejecuta make build"
"$ROOT/test/ra2/lab.sh" status >/dev/null || die "el laboratorio RA2 no está levantado: ejecuta make lab-ra2"

VAR="$WORK/var"
printf '%s' "$SECRETS_LINE" | "$BIN" run --secrets=stdin --var="$VAR" "$EXAM" >"$WORK/out" 2>"$WORK/err"
EXIT=$?
ART="$(ls "$VAR"/run-*.json 2>/dev/null | grep -v partial | head -1)"
[ -n "$ART" ] || die "la ejecución no dejó artefacto (exit $EXIT): $(cat "$WORK/err")"

expect exit-code "el examen se ejecuta entero" "$EXIT" "0"
expect estado "todos los alumnos evaluados" "$(jq -r .status "$ART")" "COMPLETE"
expect denominador "las 16 comprobaciones del examen" "$(jq -r .plan.total_weight "$ART")" "16"
expect comprobaciones "16 comprobaciones por alumno" \
  "$(jq -r '[.students[].checks|length]|unique|join(",")' "$ART")" "16"

expect nota-01 "el ejercicio completo saca 100" "$(jq -r '.students[]|select(.student_id=="alumne01").score.final_score' "$ART")" "100"
expect pass-01 "y sus 16 comprobaciones en verde" \
  "$(jq -r '[.students[]|select(.student_id=="alumne01").checks[]|select(.status=="PASS")]|length' "$ART")" "16"

expect nota-02 "el ejercicio con cinco fallos saca 69" "$(jq -r '.students[]|select(.student_id=="alumne02").score.final_score' "$ART")" "69"
expect fallos-02 "y falla exactamente lo que hizo mal" \
  "$(jq -r '[.students[]|select(.student_id=="alumne02").checks[]|select(.status=="FAIL").check_id]|sort|join(" ")' "$ART")" "$FAILED02"

# Principle 3: a wrong answer is FAIL; only a technical problem is UNEVALUATED.
expect sin-tecnicos "ningún fallo técnico enmascarado de suspenso" \
  "$(jq -r '[.students[].checks[]|select(.status=="FAIL" and .cause!="NONE")]|length' "$ART")" "0"

# Every result explainable from the JSON: what was run and what was compared.
expect explicable-cmd "cada resultado dice qué se ejecutó" \
  "$(jq -r '[.students[].checks[]|select((.execution.command|length)==0 and .valor==null)]|length' "$ART")" "0"
expect explicable-fallo "cada suspenso dice qué se esperaba y qué se encontró" \
  "$(jq -r '[.students[].checks[]|select(.status=="FAIL")|select((.assertion.expected|length)==0 or (.assertion|has("found")|not) and (.assertion.where//"")=="")]|length' "$ART")" "0"

expect huella "la identidad de cada máquina queda anotada" \
  "$(jq -r '[.warnings[]|select(.code=="HOST_KEY_ACCEPTED")]|length' "$ART")" "2"

# The password never reaches the artifact or the console (ADR-0009).
if grep -qR "$SECRET" "$VAR" "$WORK/out" "$WORK/err"; then
  bad secreto "la contraseña del aula aparece en la salida"
else
  ok secreto "la contraseña del aula no aparece en ningún sitio"
fi

echo
if [ -n "$failed" ]; then
  echo "ra2: FALLAN$failed"
  exit 1
fi
echo "ra2: el examen RA2 se ejecuta entero y cada resultado es explicable"
