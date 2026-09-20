import { app, dialog, ipcMain, shell, type WebContents } from 'electron'
import { IPC } from '../shared/ipc'
import { detectEngine } from './engine'
import { readArtifact } from './artifact'
import { RunSession, resolveRunTarget } from './run'
import { secretRefsOf } from './secrets'
import { readSettings, writeSettings } from './store'
import type { EngineStatus, RunClosed, RunRequest } from '../shared/types'

const FILTERS: Record<'exam' | 'class' | 'engine', Electron.FileFilter[]> = {
  exam: [{ name: 'Examen', extensions: ['yaml', 'yml'] }],
  class: [{ name: 'Aula', extensions: ['yaml', 'yml'] }],
  engine: [{ name: 'Motor', extensions: ['*'] }]
}

/** Where the settings file lives: the app's own data directory. */
function settingsDir(): string {
  return app.getPath('userData')
}

/**
 * The run in flight, if any. One at a time: two engines writing into the same
 * var/ would leave the teacher with two halves of a class and no way to tell
 * which artifact is which.
 */
let session: RunSession | null = null

function readRunRequest(value: unknown): RunRequest {
  const raw = (value ?? {}) as Partial<RunRequest>
  if (typeof raw.examPath !== 'string' || typeof raw.classPath !== 'string') {
    throw new Error('Falta el examen o el aula.')
  }
  const secrets: Record<string, string> = {}
  for (const [name, secret] of Object.entries(raw.secrets ?? {})) {
    if (typeof secret === 'string') secrets[name] = secret
  }
  const retryFrom = typeof raw.retryFrom === 'string' && raw.retryFrom ? raw.retryFrom : undefined
  return { examPath: raw.examPath, classPath: raw.classPath, secrets, retryFrom }
}

export function registerIpc(): void {
  ipcMain.handle(IPC.detectEngine, (): Promise<EngineStatus> =>
    detectEngine(readSettings(settingsDir()).enginePath)
  )

  ipcMain.handle(IPC.getEnginePath, (): string => readSettings(settingsDir()).enginePath)

  ipcMain.handle(IPC.setEnginePath, async (_e, path: unknown): Promise<EngineStatus> => {
    const enginePath = typeof path === 'string' ? path.trim() : ''
    if (!enginePath) throw new Error('La ruta del motor no puede estar vacía.')
    writeSettings(settingsDir(), { ...readSettings(settingsDir()), enginePath })
    return detectEngine(enginePath)
  })

  ipcMain.handle(IPC.pickFile, async (_e, kind: unknown): Promise<string | null> => {
    const key = kind === 'exam' || kind === 'class' || kind === 'engine' ? kind : 'exam'
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: FILTERS[key] })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  // http(s) only: shell.openExternal opens any scheme the system knows, and a
  // link in the interface has no business launching programs.
  ipcMain.handle(IPC.openExternal, async (_e, url: unknown): Promise<void> => {
    const target = String(url)
    if (!/^https?:\/\//i.test(target)) throw new Error('Enlace no permitido.')
    await shell.openExternal(target)
  })

  ipcMain.handle(IPC.secretRefs, (_e, classPath: unknown): string[] =>
    typeof classPath === 'string' ? secretRefsOf(classPath) : []
  )

  ipcMain.handle(IPC.startRun, (event, request: unknown): void => {
    if (session) throw new Error('Ya hay una corrección en marcha.')
    const { examPath, classPath, secrets, retryFrom } = readRunRequest(request)
    const engine = readSettings(settingsDir()).enginePath
    const target = { ...resolveRunTarget(examPath, classPath), retryFrom }
    const sender = event.sender

    session = new RunSession(engine, target, secrets, {
      onEvent: (engineEvent) => send(sender, IPC.runEvent, engineEvent),
      onClose: (exitCode, stderr) => {
        session = null
        const closed: RunClosed = { exitCode, stderr }
        send(sender, IPC.runClosed, closed)
      }
    })

    // The values stay in this process only while stdin is written; the copy
    // the renderer sent dies with this call.
    for (const name of Object.keys(secrets)) secrets[name] = ''
  })

  ipcMain.handle(IPC.readArtifact, (_e, path: unknown) => {
    if (typeof path !== 'string' || !path) throw new Error('No hay ningún resultado que abrir.')
    return readArtifact(path)
  })

  ipcMain.handle(IPC.cancelRun, (): void => {
    session?.cancel()
  })
}

/** A window that closed mid-run must not turn a send into a crash. */
function send(sender: WebContents, channel: string, payload: unknown): void {
  if (!sender.isDestroyed()) sender.send(channel, payload)
}
