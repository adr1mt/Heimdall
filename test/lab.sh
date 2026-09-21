#!/usr/bin/env bash
# Test SSH lab: one container, one command. Used by the integration suite.
#
# 127.1.2.3 on purpose, never 127.0.0.x: the old engine routed any address
# containing "127.0.0." to local execution (F-01) and A-11 checks that we do
# not.
#
# Test credentials are fictitious and public on purpose (see docs/design).
set -euo pipefail

IMAGE=heimdall-lab-ssh
NAME=alu1
HOST=127.1.2.3
PORT=2201
CONTAINERFILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

die() { echo "lab: $*" >&2; exit 1; }

require() {
  command -v podman >/dev/null || die "podman not found"
  # The integration tests wrap ssh in coreutils timeout; busybox timeout is not
  # enough (no --kill-after).
  timeout --help 2>/dev/null | grep -q -- --kill-after || die "coreutils timeout not found"
}

up() {
  require
  podman image exists "$IMAGE" || \
    podman build -t "$IMAGE" -f "$CONTAINERFILE_DIR/Containerfile" "$CONTAINERFILE_DIR"
  # --replace makes a second run idempotent instead of a name clash.
  # --hostname: the prototype exam checks that the machine identifies itself,
  # and a container's default hostname is a random id.
  podman run -d --replace --name "$NAME" --hostname "$NAME" \
    -p "$HOST:$PORT:22" "$IMAGE" >/dev/null
  for _ in $(seq 30); do
    if (exec 3<>/dev/tcp/$HOST/$PORT) 2>/dev/null; then
      echo "lab: $NAME listening on $HOST:$PORT"
      return 0
    fi
    sleep 0.5
  done
  die "$NAME did not start listening on $HOST:$PORT"
}

down() {
  podman rm -f "$NAME" >/dev/null 2>&1 || true
  echo "lab: $NAME removed"
}

status() {
  if (exec 3<>/dev/tcp/$HOST/$PORT) 2>/dev/null; then
    echo "lab: up on $HOST:$PORT"
  else
    echo "lab: down"
    exit 1
  fi
}

case "${1:-}" in
  up|down|status) "$1" ;;
  *) die "usage: lab.sh {up|down|status}" ;;
esac
