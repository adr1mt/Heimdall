#!/usr/bin/env bash
# Verify the actual release packages, their renderer, launcher and bundled engine.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="$(cat "$ROOT/VERSION")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
APPIMAGE="$ROOT/gui/dist/Heimdall-$VERSION.AppImage"
DEB="$ROOT/gui/dist/Heimdall-$VERSION.deb"
test -s "$APPIMAGE" && test -s "$DEB"
test "$(dpkg-deb --field "$DEB" Version)" = "$VERSION"
(cd "$WORK" && "$APPIMAGE" --appimage-extract > /dev/null)
python3 "$ROOT/scripts/check_apprun.py" "$WORK/squashfs-root/AppRun"
test "$("$WORK/squashfs-root/resources/heimdall" version)" = "heimdall $VERSION"
node "$ROOT/gui/scripts/smoke-package.mjs" "$WORK/squashfs-root/AppRun" auto
node "$ROOT/gui/scripts/smoke-package.mjs" "$WORK/squashfs-root/heimdall-gui" fallback
if unshare -Ur true 2>/dev/null; then
  node "$ROOT/gui/scripts/smoke-package.mjs" "$WORK/squashfs-root/heimdall-gui" sandbox
else
  echo 'Sandbox real: entorno sin user namespaces; pendiente de comprobar en otro equipo.'
fi
(cd "$ROOT/gui/dist" && sha256sum "Heimdall-$VERSION.AppImage" "Heimdall-$VERSION.deb" > SHA256SUMS && sha256sum -c SHA256SUMS)
