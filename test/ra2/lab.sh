#!/usr/bin/env bash
# RA2 lab: two student machines with KEA and BIND, one complete and one with
# mistakes. Used by test/ra2.sh and by hand when trying the exam out.
#
# 127.1.2.3 on purpose, never 127.0.0.x (F-01).
set -euo pipefail

IMAGE_PREFIX=evalonlab-ra2
HOST=127.1.2.3
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# name:variant:port
MACHINES=("ra2-bien:bien:2211" "ra2-parcial:parcial:2212")

die() { echo "ra2/lab: $*" >&2; exit 1; }

up() {
  command -v podman >/dev/null || die "podman not found"
  for m in "${MACHINES[@]}"; do
    IFS=: read -r name variant port <<<"$m"
    podman image exists "$IMAGE_PREFIX-$variant" || \
      podman build -t "$IMAGE_PREFIX-$variant" --build-arg "VARIANT=$variant" -f "$HERE/Containerfile" "$HERE"
    # NET_ADMIN: the lab creates the dummy enp2s0 the exam reads.
    # --systemd=always: the exam asks systemctl whether named is running.
    podman run -d --replace --name "$name" --hostname "$name" \
      --systemd=always --cap-add=NET_ADMIN \
      -p "$HOST:$port:22" "$IMAGE_PREFIX-$variant" >/dev/null
  done
  for m in "${MACHINES[@]}"; do
    IFS=: read -r name variant port <<<"$m"
    for _ in $(seq 60); do
      if (exec 3<>/dev/tcp/$HOST/$port) 2>/dev/null; then
        echo "ra2/lab: $name listening on $HOST:$port"
        continue 2
      fi
      sleep 0.5
    done
    die "$name did not start listening on $HOST:$port"
  done
}

down() {
  for m in "${MACHINES[@]}"; do
    IFS=: read -r name _ _ <<<"$m"
    podman rm -f "$name" >/dev/null 2>&1 || true
  done
  echo "ra2/lab: machines removed"
}

status() {
  local ok=0
  for m in "${MACHINES[@]}"; do
    IFS=: read -r name _ port <<<"$m"
    if (exec 3<>/dev/tcp/$HOST/$port) 2>/dev/null; then
      echo "ra2/lab: $name up on $HOST:$port"
    else
      echo "ra2/lab: $name down"; ok=1
    fi
  done
  exit $ok
}

case "${1:-}" in
  up|down|status) "$1" ;;
  *) die "usage: lab.sh {up|down|status}" ;;
esac
