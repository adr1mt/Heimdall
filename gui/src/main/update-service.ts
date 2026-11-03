/**
 * The updater, plugged into the real application: the network, the disk and
 * the state of the corrections.
 *
 * The policy lives in `updater.ts`, which knows nothing about electron so the
 * tests can drive it. This is only the wiring.
 */

import { app, ipcMain, net, type BrowserWindow } from 'electron'
import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { isUpdateBlocked } from './ipc'
import { downloadUpdate } from './update-download'
import { onCorrectionSettled, onCorrectionStarting } from './activity'
import { Updater } from './updater'
import type { UpdateStatus } from '../shared/types'

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
let checkForUpdates: (() => Promise<void>) | null = null
let status: UpdateStatus

export function registerUpdateIpc(): void {
  ipcMain.handle(IPC.getUpdateStatus, () => status)
  ipcMain.handle(IPC.checkForUpdates, () => checkForUpdates?.())
}

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
  const response = await net.fetch(url, {
    headers: { accept: 'application/vnd.github+json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(FEED_TIMEOUT_MS)])
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return await response.text()
}

/** Checks at startup and resumes a check deferred by classroom activity. */
export function startUpdates(win: BrowserWindow): void {
  const installedVersion = app.getVersion()
  const appImagePath = app.isPackaged ? (process.env['APPIMAGE'] ?? null) : null
  status = { installedVersion, latestVersion: null, state: appImagePath ? 'idle' : 'unsupported' }

  const windowUpdater = new Updater({
    currentVersion: installedVersion,
    appImagePath,
    downloadDir: join(app.getPath('userData'), 'updates'),
    busy: isUpdateBlocked,
    fetchText,
    // Keep untrusted HTTP responses out of Node's TLS/HTTP/Brotli stack.
    download: (url, file, signal) => downloadUpdate(url, file, signal, (url, init) => net.fetch(url, init)),
    onBusy: onCorrectionStarting,
    announce: (version) => {
      if (!win.isDestroyed()) win.webContents.send(IPC.updateReady, version)
    },
    log
  })
  updater = windowUpdater
  if (!appImagePath) return

  function publish(state: UpdateStatus['state']): void {
    status = { installedVersion, latestVersion: windowUpdater.latestVersion, state }
    if (!win.isDestroyed()) win.webContents.send(IPC.updateStatus, status)
  }

  let closed = false
  let inFlight: Promise<void> | null = null
  function retryIfIdle(): void {
    if (!closed && status.state === 'busy' && !isUpdateBlocked()) void check()
  }
  function check(): Promise<void> {
    clearTimeout(timer)
    if (closed) return Promise.resolve()
    if (inFlight) return inFlight
    if (isUpdateBlocked()) {
      publish('busy')
      return Promise.resolve()
    }
    publish('checking')
    inFlight = windowUpdater.check().then(
      (outcome) => { if (!closed) publish(outcome) },
      (error) => {
        log(String(error))
        if (!closed) publish('failed')
      }
    ).finally(() => {
      inFlight = null
      // The correction may have finished while its abort was still settling.
      retryIfIdle()
    })
    return inFlight
  }
  const timer = setTimeout(() => void check(), CHECK_DELAY_MS)
  timer.unref?.()
  const unsubscribe = onCorrectionSettled(retryIfIdle)
  checkForUpdates = check
  win.on('closed', () => {
    closed = true
    checkForUpdates = null
    clearTimeout(timer)
    unsubscribe()
  })
}

/** Installs what was waiting. The application is already on its way out. */
export function applyPendingUpdate(): void {
  updater?.applyOnQuit()
}
