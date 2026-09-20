#!/usr/bin/env bash
# Acceptance of the exam session against the lab (T063, ADR-0020).
#
# Two rounds of the same exam, one after the other, with a student who got the
# whole exam right in the first one. The criterion that matters is physical:
# the second round does not open a single connection against that student's
# machine, and the container's sshd log is the evidence.
#
# One line per criterion, OK or FALLO, and a non-zero exit if any fails.
# Needs the lab up (`make lab`) and the binary built (`make build`).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/heimdall"
EXAM="$ROOT/testdata/sesion"

# The lab password (test/README.md). Fictitious, public and only valid inside
# the container.
SECRET="TEUTON_SECRET_TEST_12345"
SECRETS_LINE="$(printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET")"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failed=""
ok()  { printf 'OK     %-5s %s\n' "$1" "$2"; }
bad() { printf 'FALLO  %-5s %s\n' "$1" "$2"; failed="$failed $1"; }
die() { echo "sesion: $*" >&2; exit 1; }
expect() { # expect <id> <description> <got> <want>
  if [ "$3" = "$4" ]; then ok "$1" "$2"; else bad "$1" "$2: obtenido $3, se esperaba $4"; fi
}

command -v jq >/dev/null || die "hace falta jq"
[ -x "$BIN" ] || die "no existe $BIN: ejecuta make build"
"$ROOT/test/lab.sh" status >/dev/null || die "el laboratorio no está levantado: ejecuta make lab"

# round <var-dir> [extra args...] -> prints the artifact it wrote
round() {
  local var="$1"; shift
  printf '%s' "$SECRETS_LINE" | "$BIN" run --secrets=stdin --var="$var" "$@" "$EXAM" \
    >"$WORK/out" 2>"$WORK/err"
  local art
  art="$(ls "$var"/run-*.json 2>/dev/null | grep -v partial | head -1)"
  [ -n "$art" ] || die "una vuelta no dejó artefacto: $(cat "$WORK/err")"
  printf '%s' "$art"
}

# --------------------------------------------------------------------------
# First round: alumne01 gets the whole exam right, alumne02 cannot be reached.
# --------------------------------------------------------------------------
R1="$(round "$WORK/var1")"
expect S-1 "la primera vuelta evalúa entero al alumno que lo tiene todo bien" \
  "$(jq -r '.students[] | select(.student_id=="alumne01") | "\(.status) \(.score.final_score)"' "$R1")" \
  "OK 100"

"$BIN" session "$R1" >"$WORK/sesion1.json" 2>"$WORK/err1"
expect S-2 "la sesión da por terminado a ese alumno" \
  "$(jq -r '.students[] | select(.student_id=="alumne01") | "\(.status) \(.from_round)"' "$WORK/sesion1.json")" \
  "FINISHED 1"
expect S-2 "la sesión sale por la salida estándar con su propio kind" \
  "$(jq -r '.kind' "$WORK/sesion1.json")" "session"

# --------------------------------------------------------------------------
# Second round with the session: the finished student is not dialled at all.
# The sshd log of the container before and after is the whole criterion.
# --------------------------------------------------------------------------
LOG_BEFORE="$(podman logs alu1 2>&1 | wc -l)"
R2="$(round "$WORK/var2" --session="$R1")"
LOG_AFTER="$(podman logs alu1 2>&1 | wc -l)"
expect S-3 "la segunda vuelta no abre ninguna conexión contra su máquina" \
  "$LOG_AFTER" "$LOG_BEFORE"

expect S-4 "el artefacto dice por qué no se corrigió a ese alumno" \
  "$(jq -r '.students[] | select(.student_id=="alumne01") | "\(.status) \(.score.status) \(.score.final_score) \(if (.reason // "") == "" then "sin-motivo" else "con-motivo" end)"' "$R2")" \
  "EXCLUDED EXCLUDED null con-motivo"
expect S-4 "el motivo dice de qué vuelta viene su nota" \
  "$(jq -r '.students[] | select(.student_id=="alumne01") | .reason' "$R2" | grep -c 'vuelta 1')" "1"

expect S-5 "el resto de la clase recibe las mismas comprobaciones y los mismos pesos" \
  "$(jq -r '[.plan.total_weight, (.plan.check_ids|length)] | @csv' "$R1")" \
  "$(jq -r '[.plan.total_weight, (.plan.check_ids|length)] | @csv' "$R2")"
expect S-5 "las dos vueltas son del mismo examen" \
  "$(jq -r '.plan_hash' "$R1")" "$(jq -r '.plan_hash' "$R2")"

# --------------------------------------------------------------------------
# The session over both rounds: the grade is still the one of round 1.
# --------------------------------------------------------------------------
"$BIN" session "$R1" "$R2" >"$WORK/sesion2.json" 2>"$WORK/err2"
CODE2=$?
expect S-6 "la nota de la sesión sigue siendo la que ya tenía" \
  "$(jq -r '.students[] | select(.student_id=="alumne01") | "\(.status) \(.from_round) \(.score.final_score)"' "$WORK/sesion2.json")" \
  "FINISHED 1 100"
expect S-6 "queda alguien sin nota de sesión, y el código de salida lo dice" "$CODE2" "3"
expect S-6 "el histórico guarda las dos vueltas de cada alumno" \
  "$(jq -r '[.students[].rounds | length] | unique | tostring' "$WORK/sesion2.json")" "[2]"

# --------------------------------------------------------------------------
# The control: without --session the same round does dial that machine. Without
# this, S-3 would pass for the wrong reason.
# --------------------------------------------------------------------------
LOG_BEFORE3="$(podman logs alu1 2>&1 | wc -l)"
round "$WORK/var3" >/dev/null
LOG_AFTER3="$(podman logs alu1 2>&1 | wc -l)"
if [ "$LOG_AFTER3" -gt "$LOG_BEFORE3" ]; then
  ok S-7 "sin --session esa misma vuelta sí abre conexión: S-3 mide algo"
else
  bad S-7 "sin --session tampoco se conectó a nadie: S-3 no está midiendo nada"
fi

# --------------------------------------------------------------------------
# A session of another exam stops before touching a machine.
# --------------------------------------------------------------------------
OTHER="$WORK/otro.json"
jq '.plan_hash = "hash-de-otro-examen"' "$R1" >"$OTHER"
LOG_BEFORE4="$(podman logs alu1 2>&1 | wc -l)"
printf '%s' "$SECRETS_LINE" | "$BIN" run --secrets=stdin --var="$WORK/var4" --session="$OTHER" "$EXAM" \
  >"$WORK/out4" 2>"$WORK/err4"
CODE4=$?
LOG_AFTER4="$(podman logs alu1 2>&1 | wc -l)"
expect S-8 "una sesión de otro examen sale con exit 2" "$CODE4" "2"
expect S-8 "y no toca ninguna máquina" "$LOG_AFTER4" "$LOG_BEFORE4"
expect S-8 "y no escribe nada en var/" \
  "$([ -d "$WORK/var4" ] && echo existe || echo vacio)" "vacio"

# --------------------------------------------------------------------------
echo
if [ -n "$failed" ]; then
  echo "sesion: fallan criterios:$failed"
  exit 1
fi
echo "sesion: la sesión de examen en verde (S-1 a S-8)"
