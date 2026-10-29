// Electron's npm package no longer downloads its runtime automatically.
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD !== '1') {
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, '../node_modules/electron/install.js')], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
