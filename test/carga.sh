#!/usr/bin/env bash
# T030: a whole class against one machine.
#
# F-05: with no limit, the engine itself produces zeros. OpenSSH refuses
# connections past MaxStartups (10:30:100 by default) before anybody has typed
# a password, and each refusal would reach the artifact as a check nobody could
# evaluate. This measures it: the bounded run must not lose a single check, and
# the unbounded control says how many it would lose.
#
# Needs make lab and the binary built (make build).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/heimdall"
STUDENTS=100

# Lab password: fictitious, public, only valid inside the container.
SECRET="TEUTON_SECRET_TEST_12345"
SECRETS_LINE="$(printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET")"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failed=""
ok()  { printf 'OK     %-24s %s\n' "$1" "$2"; }
bad() { printf 'FALLO  %-24s %s\n' "$1" "$2"; failed="$failed $1"; }
die() { echo "carga: $*" >&2; exit 1; }

command -v jq >/dev/null || die "hace falta jq"
[ -x "$BIN" ] || die "no existe $BIN: ejecuta make build"
"$ROOT/test/lab.sh" status >/dev/null || die "el laboratorio no está levantado: ejecuta make lab"

# The exam is deliberately tiny: what is under test is opening the sessions,
# not what runs inside them.
EXAM="$WORK/examen"
mkdir -p "$EXAM"
cat > "$EXAM/examen.yaml" <<'YAML'
examen: "Carga: una máquina, toda la clase"
version: 1
hosts: [host1]
por_defecto: { peso: 1, timeout: 20s }
grupos:
  - grupo: "Base"
    comprobaciones:
      - id: c1-usuario
        descripcion: "La cuenta del alumno existe"
        en: host1
        cmd: ["id", "-un"]
        igual_a: "alumno"
YAML

{
  cat <<'YAML'
aula: "Carga"
version: 1

comun:
  hosts:
    host1:
      puerto: 2201
      usuario: "alumno"
      password_ref: "${AULA_PASSWORD}"
  timeouts:
    conexion: 10s
    alumno: 5m

alumnos:
YAML
  for i in $(seq -w 1 $STUDENTS); do
    printf -- '  - id: alu%s\n    nombre: "Alumna %s"\n    hosts:\n      host1: { ip: "127.1.2.3", puerto: 2201 }\n    usuario: "alumno"\n' "$i" "$i"
  done
} > "$EXAM/aula.yaml"

# run <etiqueta> <flags...> -> echoes "<unevaluated> <connect_failed> <reintentos> <exit> <segundos>"
run_class() {
  local label="$1"; shift
  local var="$WORK/var-$label"
  local t0 t1
  t0=$(date +%s)
  printf '%s' "$SECRETS_LINE" | "$BIN" run --secrets=stdin --var="$var" "$@" "$EXAM" \
    >"$WORK/out-$label" 2>"$WORK/err-$label"
  local exit=$?
  t1=$(date +%s)
  local art
  art="$(ls "$var"/run-*.json 2>/dev/null | grep -v partial | head -1)"
  [ -n "$art" ] || die "la ejecución $label no ha escrito artefacto"
  local unev cf retries
  unev=$(jq '[.students[].checks[] | select(.status=="UNEVALUATED")] | length' "$art")
  cf=$(jq '[.students[].checks[] | select(.cause=="CONNECT_FAILED")] | length' "$art")
  # A connection that needed more than one attempt is the server having said
  # no: that is MaxStartups, absorbed by the retry instead of the cap.
  retries=$(jq '[.students[].checks[] | select(.execution.connect_attempts > 1)] | length' "$art")
  echo "$unev $cf $retries $exit $((t1 - t0))"
}

echo "carga: $STUDENTS alumnos contra 127.1.2.3:2201, MaxStartups por defecto"

read -r UNEV CF RETRIES EXIT SECS <<<"$(run_class acotada --concurrency=8 --host-concurrency=4)"
echo "carga: acotada (8 alumnos, 4 conexiones por máquina): ${SECS}s, $RETRIES conexiones con reintento"
[ "$UNEV" -eq 0 ] \
  && ok A-15 "ninguna comprobación sin evaluar con el tope puesto" \
  || bad A-15 "$UNEV comprobaciones sin evaluar, $CF por conexión rechazada"
[ "$EXIT" -eq 0 ] \
  && ok A-15-exit "exit 0: la clase entera se ha evaluado" \
  || bad A-15-exit "exit $EXIT y se esperaba 0"

# Control, not a criterion: it measures what the cap is for. A machine fast
# enough to answer everybody would lose nothing here, and that is fine.
read -r UNEV_C CF_C RETRIES_C EXIT_C SECS_C <<<"$(run_class libre --concurrency=$STUDENTS --host-concurrency=$STUDENTS)"
echo "carga: control sin tope por máquina ($STUDENTS a la vez): ${SECS_C}s, $UNEV_C sin evaluar ($CF_C por conexión rechazada), $RETRIES_C conexiones con reintento, exit $EXIT_C"

if [ -n "$failed" ]; then
  echo "carga: FALLAN:$failed"
  exit 1
fi
echo "carga: todo en verde"
