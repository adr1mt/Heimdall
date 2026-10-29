// Linux artifacts from Electron's maintained packager and native package tools.
import { packager } from '@electron/packager'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, chmod, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const repo = resolve(root, '..')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const pin = JSON.parse(await readFile(join(root, 'build/appimage-runtime.json'), 'utf8'))
const dist = join(root, 'dist')
const unpacked = join(dist, 'linux-unpacked')

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', timeout: 300_000 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`)
}

// Use the same fallback policy for the AppImage and .deb, without a setuid helper.
const launcher = `#!/bin/sh
set -eu
HERE="\${APPDIR:-$(dirname -- "$(readlink -f -- "$0")")}"
for arg do
  if [ "$arg" = --no-sandbox ]; then exec "$HERE/heimdall-gui" "$@"; fi
done
if unshare -Ur true 2>/dev/null; then
  exec "$HERE/heimdall-gui" "$@"
else
  exec "$HERE/heimdall-gui" --no-sandbox "$@"
fi
`
const desktop = (installed) => `[Desktop Entry]
Name=Heimdall
Comment=Evaluación de prácticas de sistemas y redes por SSH
Exec=${installed ? '/opt/Heimdall/AppRun' : 'AppRun'} %U
Icon=heimdall-gui
Type=Application
Categories=Education;
Keywords=heimdall;evaluacion;notas;aula;
StartupWMClass=heimdall-gui
Terminal=false
`

if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Packaging requires Linux x64')
run('mksquashfs', ['-version'])
run('dpkg-deb', ['--version'])
await access(join(repo, 'bin/heimdall'))
await access(join(root, 'out/preload/index.cjs'))
await mkdir(dist, { recursive: true })
const work = await mkdtemp(join(tmpdir(), 'heimdall-package-'))
try {
  const [built] = await packager({
    dir: root, out: work, name: 'Heimdall', executableName: 'heimdall-gui',
    platform: 'linux', arch: 'x64', electronVersion: pkg.devDependencies.electron,
    appVersion: pkg.version, appBundleId: 'net.xeill.elpuig.heimdall',
    asar: true, overwrite: true,
    ignore: [/^\/(src|scripts|tests|build|dist)(\/|$)/, /^\/(tsconfig.*|.*\.config\..*|README\.md|\.npmrc)$/],
    extraResource: [join(repo, 'bin/heimdall'), join(root, 'build/icon.png')]
  })
  await rm(unpacked, { recursive: true, force: true })
  // cp also works when /tmp and the checkout reside on different filesystems.
  await cp(built, unpacked, { recursive: true })
  await writeFile(join(unpacked, 'AppRun'), launcher, { mode: 0o755 })
  await writeFile(join(unpacked, 'heimdall-gui.desktop'), desktop(false))
  await cp(join(root, 'build/icon.png'), join(unpacked, 'heimdall-gui.png'))
  await cp(join(root, 'build/icon.png'), join(unpacked, '.DirIcon'))

  // Native type-2 runtime: no shell wrapper in front of the ELF header, no libfuse2.
  // GitHub asset IDs and SHA-256 pin the reviewed binary even for continuous builds.
  const response = await fetch(pin.url, {
    headers: { Accept: 'application/octet-stream' }, signal: AbortSignal.timeout(120_000)
  })
  if (!response.ok) throw new Error(`AppImage runtime download: HTTP ${response.status}`)
  const runtime = Buffer.from(await response.arrayBuffer())
  if (createHash('sha256').update(runtime).digest('hex') !== pin.sha256) throw new Error('AppImage runtime SHA-256 mismatch')
  const squash = join(work, 'payload.squashfs')
  run('mksquashfs', [unpacked, squash, '-noappend', '-comp', 'zstd', '-all-root', '-no-xattrs', '-processors', '2'])
  const image = join(dist, `Heimdall-${pkg.version}.AppImage`)
  const pendingImage = image + '.pending'
  await writeFile(pendingImage, runtime)
  await pipeline(createReadStream(squash), createWriteStream(pendingImage, { flags: 'a' }))
  await chmod(pendingImage, 0o755)
  run(pendingImage, ['--appimage-version'])
  await rename(pendingImage, image)

  const debRoot = join(work, 'deb')
  const control = join(debRoot, 'DEBIAN')
  await mkdir(control, { recursive: true })
  await cp(unpacked, join(debRoot, 'opt/Heimdall'), { recursive: true })
  await rm(join(debRoot, 'opt/Heimdall/heimdall-gui.desktop'))
  await mkdir(join(debRoot, 'usr/bin'), { recursive: true })
  await symlink('/opt/Heimdall/AppRun', join(debRoot, 'usr/bin/heimdall-gui'))
  const applications = join(debRoot, 'usr/share/applications')
  await mkdir(applications, { recursive: true })
  await writeFile(join(applications, 'heimdall-gui.desktop'), desktop(true))
  for (const icon of await readdir(join(root, 'build/icons'))) {
    if (!/^\d+x\d+\.png$/.test(icon)) continue
    const directory = join(debRoot, 'usr/share/icons/hicolor', basename(icon, '.png'), 'apps')
    await mkdir(directory, { recursive: true })
    await cp(join(root, 'build/icons', icon), join(directory, 'heimdall-gui.png'))
  }
  await writeFile(join(control, 'control'), `Package: heimdall-gui
Version: ${pkg.version}
Architecture: amd64
Maintainer: Adria Munoz <adriamt@elpuig.xeill.net>
Section: education
Priority: optional
Homepage: ${pkg.homepage}
Depends: libgtk-3-0 | libgtk-3-0t64, libnotify4, xdg-utils, libnss3, libasound2 | libasound2t64, libgbm1, libxss1, libxtst6, libatk-bridge2.0-0 | libatk-bridge2.0-0t64, libdrm2, libxkbcommon0, libx11-xcb1, libxcb-dri3-0, libsecret-1-0
Description: Evaluacion de practicas de sistemas y redes por SSH
 Corrige las practicas del alumnado con el motor Heimdall incluido.
`)
  const deb = join(dist, `Heimdall-${pkg.version}.deb`)
  run('dpkg-deb', ['--root-owner-group', '--build', debRoot, deb + '.pending'])
  await rename(deb + '.pending', deb)
  for (const artifact of [image, deb]) console.log(`Created ${artifact}`)
} finally {
  await rm(work, { recursive: true, force: true })
}
