/**
 * The updater, plugged into the real application: the network, the disk and
 * the state of the corrections.
 *
 * The policy lives in `updater.ts`, which knows nothing about electron so the
 * tests can drive it. This is only the wiring.
 */

import { app, type BrowserWindow } from 'electron'
import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { isExamModeActive, isRunActive } from './ipc'
import { downloadUpdate } from './update-download'
import { onCorrectionStarting } from './activity'
import { Updater } from './updater'

/**
 * How long after opening the check waits.
 *
 * It was a minute, to stay behind the first correction of the class. Starting
 * a correction or exam mode already cancels the check and its download on the
 * spot, so the minute protected nothing and cost every short session its
 * update: opening the program to look at something and closing it never
 * checked at all. Ten seconds keeps the window free while it appears.
 */
const CHECK_DELAY_MS = 10_000

/** Fifteen seconds is plenty for a small JSON; a hung feed must not linger. */
const FEED_TIMEOUT_MS = 15_000

let updater: Updater | null = null

/** Past this the log keeps only its newer half. */
const LOG_MAX_BYTES = 256 * 1024

/**
 * The updater's log, also on disk.
 *
 * Launched from the menu, stderr goes nowhere: an update that failed left no
 * trace of why. Nothing here is secret —versions, public URLs and errors— so
 * it is written as it comes.
 */
function log(message: string): void {
  console.error(`[heimdall-gui] actualización: ${message}`)
  try {
    const dir = app.getPath('logs')
    const file = join(dir, 'actualizacion.log')
    mkdirSync(dir, { recursive: true })
    try {
      if (statSync(file).size > LOG_MAX_BYTES) {
        const text = readFileSync(file, 'utf-8')
        writeFileSync(file, text.slice(text.indexOf('\n', text.length / 2) + 1))
      }
    } catch {
      // No log yet.
    }
    appendFileSync(file, `${new Date().toISOString()} ${message}\n`)
  } catch {
    // A log that cannot be written is not a reason to bother the class.
  }
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: 'application/vnd.github+json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(FEED_TIMEOUT_MS)])
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return await response.text()
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
    download: downloadUpdate,
    onBusy: onCorrectionStarting,
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
