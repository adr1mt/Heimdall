#!/usr/bin/env bash
# Install/remove the real .deb in disposable Ubuntu containers, never the host.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="$(cat "$ROOT/VERSION")"
PACKAGE="$ROOT/gui/dist/Heimdall-$VERSION.deb"
test -s "$PACKAGE"
for release in 24.04 26.04; do
  podman run --rm -v "$PACKAGE:/tmp/heimdall.deb:ro" -e EXPECTED_VERSION="$VERSION" \
    "docker.io/library/ubuntu:$release" bash -euc '
      apt-get update -qq
      DEBIAN_FRONTEND=noninteractive apt-get install -y /tmp/heimdall.deb > /tmp/install.log 2>&1 || { cat /tmp/install.log; exit 1; }
      test "$(dpkg-query -W -f="\${Version}" heimdall-gui)" = "$EXPECTED_VERSION"
      engine=$(dpkg -L heimdall-gui | sed -n "/\/resources\/heimdall$/p")
      test -x "$engine"
      test "$("$engine" version)" = "heimdall $EXPECTED_VERSION"
      dpkg --remove heimdall-gui
      test ! -e "$engine"
      echo "Ubuntu: .deb installed, engine version verified and package removed"
    '
done
