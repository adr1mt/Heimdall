#!/usr/bin/env bash
# Full session acceptance with one perfect student and one unavailable host.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
SESSION_WORK="$(mktemp -d /tmp/heimdall-session-XXXXXX)"
trap 'rm -rf "$SESSION_WORK"' EXIT
mkdir -p "$SESSION_WORK/project"
cp "$REPO/testdata/sesion/examen.yaml" "$SESSION_WORK/project/"
printf '%s' HEIMDALL_SECRET_TEST_12345 > "$SESSION_WORK/secret"
chmod 600 "$SESSION_WORK/secret"
cd "$REPO/gui"
HEIMDALL_ENGINE="$REPO/bin/heimdall" PROJECT="$SESSION_WORK/project" \
LAB_SECRET_FILE="$SESSION_WORK/secret" CHAIN=1 DUMP=1 \
npm run --silent examen-lab -- --user-data-dir="$SESSION_WORK/profile"
