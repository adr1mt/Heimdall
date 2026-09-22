/**
 * The updater, plugged into the real application: the network, the disk and
 * the state of the corrections.
 *
 * The policy lives in `updater.ts`, which knows nothing about electron so the
 * tests can drive it. This is only the wiring.
 */

import { createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { isExamModeActive, isRunActive } from './ipc'
import { Updater } from './updater'

/**
 * How long after opening the check waits.
 *
 * Starting a class is the busiest minute of the hour: the first correction
 * goes out then, and this has to be behind it. It also gives exam mode time
 * to be switched on, which cancels the check outright.
 */
const CHECK_DELAY_MS = 60_000

/** One minute is plenty for a small JSON; a hung feed must not linger. */
const FEED_TIMEOUT_MS = 15_000

let updater: Updater | null = null

function log(message: string): void {
  console.error(`[heimdall-gui] actualización: ${message}`)
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS)
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return await response.text()
}

/** Whole file or nothing: a half download never stays behind to be installed. */
async function download(url: string, dest: string): Promise<void> {
  const partial = `${dest}.part`
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    if (!response.body) throw new Error('la descarga llegó vacía')
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(partial))
    const { rename } = await import('node:fs/promises')
    await rename(partial, dest)
  } catch (error) {
    await rm(partial, { force: true }).catch(() => undefined)
    throw error
  }
}

/**
 * Starts watching for new versions. Never throws and never opens a dialog:
 * the worst that an update can do to a lesson is a line in the log.
 */
export function startUpdates(win: BrowserWindow): void {
  updater = new Updater({
    currentVersion: app.getVersion(),
    // Only the AppImage replaces itself. A `.deb` is apt's business and
    // during development there is nothing to update.
    appImagePath: app.isPackaged ? (process.env['APPIMAGE'] ?? null) : null,
    downloadDir: join(app.getPath('userData'), 'updates'),
    busy: () => isRunActive() || isExamModeActive(),
    fetchText,
    download,
    announce: (version) => {
      if (!win.isDestroyed()) win.webContents.send(IPC.updateReady, version)
    },
    log
  })

  const timer = setTimeout(() => {
    updater?.check().catch((error) => log(String(error)))
  }, CHECK_DELAY_MS)
  // An application closed in the first minute leaves nothing running behind.
  timer.unref?.()
  win.on('closed', () => clearTimeout(timer))
}

/** Installs what was waiting. The application is already on its way out. */
export function applyPendingUpdate(): void {
  updater?.applyOnQuit()
}
