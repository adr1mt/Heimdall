#!/usr/bin/env bash
# T031: how the engine scales, measured instead of guessed.
#
# Two questions, the ones PERFORMANCE.md §6 asks of the new engine:
#
#   1. time and peak memory with 10 / 30 / 100 students at several global
#      caps, which is what fixes the default of --concurrency (D-6);
#   2. peak memory with a student machine that dumps 1 / 20 / 100 / 300 MB,
#      which must stay flat if the output limit works.
#
# This is a measurement, not a test: it prints a table and returns 0 unless a
# run loses a check. Needs make lab and make build.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/evalon"

# Lab password: fictitious, public, only valid inside the container.
SECRET="TEUTON_SECRET_TEST_12345"
SECRETS_LINE="$(printf '{"schema":1,"secrets":{"AULA_PASSWORD":"%s"}}\n' "$SECRET")"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failed=""
die() { echo "rendimiento: $*" >&2; exit 1; }

command -v jq >/dev/null || die "hace falta jq"
[ -x /usr/bin/time ] || die "hace falta /usr/bin/time"
[ -x "$BIN" ] || die "no existe $BIN: ejecuta make build"
"$ROOT/test/lab.sh" status >/dev/null || die "el laboratorio no está levantado: ejecuta make lab"

# --- fixtures ---------------------------------------------------------------

# class_exam <dir> <students> <cmd-json> <timeout> [assertion] [checks]
class_exam() {
  local dir="$1" n="$2" cmd="$3" to="$4" assertion="${5:-contiene: \"1\"}" checks="${6:-1}"
  mkdir -p "$dir"
  {
    cat <<YAML
examen: "Medición de rendimiento"
version: 1
hosts: [host1]
por_defecto: { peso: 1, timeout: $to }
grupos:
  - grupo: "Base"
    comprobaciones:
YAML
    for k in $(seq 1 "$checks"); do
      cat <<YAML
      - id: c$k
        descripcion: "La máquina responde ($k)"
        en: host1
        cmd: $cmd
        $assertion
YAML
    done
  } > "$dir/examen.yaml"
  {
    cat <<'YAML'
aula: "Medición"
version: 1

comun:
  hosts:
    host1:
      puerto: 2201
      usuario: "alumno"
      password_ref: "${AULA_PASSWORD}"
  timeouts:
    conexion: 10s
    alumno: 10m

alumnos:
YAML
    for i in $(seq -w 1 "$n"); do
      printf -- '  - id: alu%s\n    nombre: "Alumna %s"\n    hosts:\n      host1: { ip: "127.1.2.3", puerto: 2201 }\n' "$i" "$i"
    done
  } > "$dir/aula.yaml"
}

# measure <dir> <label> <flags...> -> "<segundos> <rss_mb> <sin_evaluar> <bytes> <exit>"
measure() {
  local dir="$1" label="$2"; shift 2
  local var="$WORK/var-$label" tf="$WORK/time-$label"
  printf '%s' "$SECRETS_LINE" | /usr/bin/time -f '%e %M' -o "$tf" \
    "$BIN" run --secrets=stdin --var="$var" "$@" "$dir" \
    >"$WORK/out-$label" 2>"$WORK/err-$label"
  local exit=$?
  # /usr/bin/time prepends "Command exited with non-zero status N".
  local secs kb
  read -r secs kb <<<"$(tail -1 "$tf")"
  local art
  art="$(ls "$var"/run-*.json 2>/dev/null | grep -v partial | head -1)"
  [ -n "$art" ] || die "la ejecución $label no ha escrito artefacto"
  local unev bytes
  unev=$(jq '[.students[].checks[] | select(.status=="UNEVALUATED")] | length' "$art")
  bytes=$(jq '[.students[].checks[].execution.stdout.bytes_total // 0] | max' "$art")
  echo "$secs $((kb / 1024)) $unev $bytes $exit"
}

# --- 1. students ------------------------------------------------------------

echo "rendimiento: 1. clase entera contra una máquina (host-concurrency=4)"
printf '%-9s %-12s %9s %9s %12s\n' alumnos concurrency tiempo RSS sin_evaluar

for n in 10 30 100; do
  class_exam "$WORK/clase-$n" "$n" '["id", "-un"]' 20s
  for c in 4 8 16 32 "$n"; do
    [ "$c" -gt "$n" ] && continue
    read -r SECS RSS UNEV _ EXIT <<<"$(measure "$WORK/clase-$n" "n$n-c$c" \
      --concurrency="$c" --host-concurrency=4)"
    printf '%-9s %-12s %8ss %8sM %12s\n' "$n" "$c" "$SECS" "$RSS" "$UNEV"
    [ "$UNEV" -eq 0 ] || failed="$failed n$n-c$c"
    [ "$EXIT" -eq 0 ] || failed="$failed n$n-c$c-exit$EXIT"
  done
done

# --- 2. output size ---------------------------------------------------------

# seq is the cheapest way to make a student machine emit megabytes of real
# text with a single argument vector: no shell, no pipe.
echo
echo "rendimiento: 2. un alumno cuya máquina escupe megabytes (seq)"
printf '%-12s %9s %9s %14s %s\n' salida tiempo RSS leído estado

for mb in 1 20 100 300; do
  case $mb in
    1)   count=150000 ;;
    20)  count=2900000 ;;
    100) count=13500000 ;;
    300) count=40000000 ;;
  esac
  class_exam "$WORK/salida-$mb" 1 "[\"seq\", \"1\", \"$count\"]" 5m
  read -r SECS RSS UNEV BYTES EXIT <<<"$(measure "$WORK/salida-$mb" "mb$mb" \
    --concurrency=1 --host-concurrency=1)"
  # Past the 8 MB hard cut the engine stops reading and the session dies, so
  # the check comes out UNEVALUATED. That is the safe side —nobody is failed
  # for it— and it is what the estado column records.
  estado=$([ "$UNEV" -eq 0 ] && echo evaluada || echo "sin evaluar")
  printf '%-12s %8ss %8sM %13sK %s\n' "${mb}MB" "$SECS" "$RSS" "$((BYTES / 1024))" "$estado"
  [ "$EXIT" -eq 0 ] || [ "$EXIT" -eq 3 ] || failed="$failed salida-$mb-exit$EXIT"
done

# --- 3. what the global cap costs -------------------------------------------

# With every student on their own machine the per-host cap never bites and the
# global cap alone decides how long a class takes. Six seconds of command per
# student make that visible: the lab has one container, but what is under test
# here is the engine's own queue, not the server.
echo
echo "rendimiento: 3. coste del tope global (30 alumnos, 6 s de comando cada uno)"
printf '%-12s %9s %9s\n' concurrency tiempo RSS

# Two checks, not one: what the teacher waits for is the exam, not a command.
class_exam "$WORK/lento" 30 '["sleep", "3"]' 60s 'exit_code: 0' 2

for c in 4 8 16 30; do
  read -r SECS RSS UNEV _ EXIT <<<"$(measure "$WORK/lento" "lento-c$c" \
    --concurrency="$c" --host-concurrency=30)"
  printf '%-12s %8ss %8sM\n' "$c" "$SECS" "$RSS"
  [ "$UNEV" -eq 0 ] || failed="$failed lento-c$c"
  [ "$EXIT" -eq 0 ] || failed="$failed lento-c$c-exit$EXIT"
done

if [ -n "$failed" ]; then
  echo
  echo "rendimiento: medidas con resultado inesperado:$failed"
  exit 1
fi
echo
echo "rendimiento: ninguna comprobación perdida por la concurrencia"
