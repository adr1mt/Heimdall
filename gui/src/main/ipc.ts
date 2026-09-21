import { statSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { app, dialog, ipcMain, powerSaveBlocker, shell, type WebContents } from 'electron'
import { IPC } from '../shared/ipc'
import { detectEngine } from './engine'
import { readArtifact } from './artifact'
import { consolidateChain } from './consolidate'
import { readExamSession } from './session'
import { listRuns, varDirOf } from './history'
import { RunSession, resolveRunTarget } from './run'
import { describeClass, describeExam } from './describe'
import { secretRefsOf } from './secrets'
import { readSettings, writeSettings } from './store'
import { readClasses, writeClasses } from './classes'
import { readGroup, type ClassGroup } from '../shared/classes'
import type { Description } from '../shared/describe'
import type { EngineStatus, ExamModeRequest, RunClosed, RunRequest } from '../shared/types'

const FILTERS: Record<'exam' | 'class' | 'engine' | 'result', Electron.FileFilter[]> = {
  exam: [{ name: 'Examen', extensions: ['yaml', 'yml'] }],
  class: [{ name: 'Aula', extensions: ['yaml', 'yml'] }],
  engine: [{ name: 'Motor', extensions: ['*'] }],
  result: [{ name: 'Resultado', extensions: ['json'] }]
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

/** Whether an engine is alive right now. The window asks before closing. */
export function isRunActive(): boolean {
  return session !== null
}

/**
 * Stops the engine the way the teacher's «Detener» does. Used when the window
 * is closed mid-correction: the child would otherwise outlive the
 * application, and what it has corrected is kept because it is cancelled and
 * not killed.
 */
export function cancelActiveRun(): void {
  session?.cancel()
}

/**
 * Exam mode, as this process sees it.
 *
 * It is kept here and not only in the renderer for two reasons. Closing the
 * window has to ask even when the interface is stuck, and between two passes
 * there is no engine at all for almost the whole interval, so «is something
 * running» is not the question the window can ask. And the credentials of the
 * class have to survive from one pass to the next without ever being written:
 * they live in this variable and nowhere else, and they are wiped when the
 * mode stops or the application quits (ADR-0009).
 */
let examMode = false
let examSecrets: Record<string, string> = {}
let keepAwakeId: number | null = null

export function isExamModeActive(): boolean {
  return examMode
}

/**
 * Keeps the computer awake while the exam lasts. The teacher does not touch
 * the keyboard —the application corrects on its own and the panel is
 * projected—, so the desktop calls the computer idle and suspends it, and a
 * suspended computer stops correcting the class. `prevent-display-sleep` and
 * not `prevent-app-suspension`: the screen is projected and must stay on too.
 */
function setKeepAwake(active: boolean): void {
  if (active) {
    if (keepAwakeId === null || !powerSaveBlocker.isStarted(keepAwakeId)) {
      keepAwakeId = powerSaveBlocker.start('prevent-display-sleep')
    }
    return
  }
  if (keepAwakeId !== null && powerSaveBlocker.isStarted(keepAwakeId)) {
    powerSaveBlocker.stop(keepAwakeId)
  }
  keepAwakeId = null
}

/** Wipes the credentials of the exam and gives back control of suspension. */
export function endExamMode(): void {
  for (const name of Object.keys(examSecrets)) examSecrets[name] = ''
  examSecrets = {}
  examMode = false
  setKeepAwake(false)
}

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
  const sessionRounds = Array.isArray(raw.sessionRounds)
    ? raw.sessionRounds.filter((round): round is string => typeof round === 'string' && !!round)
    : []
  // A round of a session corrects the whole class; --retry repeats what was
  // left unevaluated. The engine refuses both at once, and so does this.
  if (retryFrom && sessionRounds.length > 0) {
    throw new Error('Una vuelta del examen y un reintento son dos cosas distintas y no se piden juntas.')
  }
  return { examPath: raw.examPath, classPath: raw.classPath, secrets, retryFrom, sessionRounds }
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
    const key =
      kind === 'exam' || kind === 'class' || kind === 'engine' || kind === 'result' ? kind : 'exam'
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

  ipcMain.handle(IPC.describe, (_e, paths: unknown): Description => {
    const raw = (paths ?? {}) as { examPath?: unknown; classPath?: unknown }
    return {
      exam: typeof raw.examPath === 'string' ? describeExam(raw.examPath) : null,
      classroom: typeof raw.classPath === 'string' ? describeClass(raw.classPath) : null
    }
  })

  // The folder of a file the teacher chose, and only a folder: shell.openPath
  // on a file executes whatever the desktop associates with it, and a
  // `.desktop` is a program.
  ipcMain.handle(IPC.openFolder, async (_e, path: unknown): Promise<void> => {
    const target = typeof path === 'string' ? dirname(path) : ''
    if (!target || !statSync(target, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error('No hay ninguna carpeta que abrir.')
    }
    const problem = await shell.openPath(target)
    if (problem) throw new Error(problem)
  })

  ipcMain.handle(IPC.setExamMode, (_e, request: unknown): void => {
    const raw = (request ?? {}) as Partial<ExamModeRequest>
    if (typeof raw.active !== 'boolean') throw new Error('El modo examen no es válido.')
    if (!raw.active) {
      endExamMode()
      return
    }
    endExamMode()
    for (const [name, secret] of Object.entries(raw.secrets ?? {})) {
      if (typeof secret === 'string') examSecrets[name] = secret
    }
    examMode = true
    setKeepAwake(true)
  })

  ipcMain.handle(IPC.startRun, (event, request: unknown): void => {
    // Last line of defence against two engines writing into the same var/.
    // The renderer's timer already refuses to launch one on top of another;
    // this one does not depend on the renderer being right.
    if (session) throw new Error('Ya hay una corrección en marcha.')
    const { examPath, classPath, secrets, retryFrom, sessionRounds } = readRunRequest(request)
    // Passes after the first carry no credentials: the teacher typed them
    // once, when the exam started, and they have not left this process.
    if (examMode && Object.keys(secrets).length === 0) Object.assign(secrets, examSecrets)
    const engine = readSettings(settingsDir()).enginePath
    const target = { ...resolveRunTarget(examPath, classPath), retryFrom, sessionRounds }
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

  // Reading a chain touches no machine either: `heimdall consolidate` opens
  // the artifacts already on disk and prints a view of them.
  ipcMain.handle(IPC.consolidate, (_e, path: unknown) => {
    if (typeof path !== 'string' || !path) throw new Error('No hay ninguna cadena que consolidar.')
    return consolidateChain(readSettings(settingsDir()).enginePath, path)
  })

  // Reading a session touches no machine either: `heimdall session` opens the
  // rounds already on disk and says what each student's exam is worth.
  ipcMain.handle(IPC.session, (_e, roundPaths: unknown) => {
    const rounds = Array.isArray(roundPaths)
      ? roundPaths.filter((round): round is string => typeof round === 'string' && !!round)
      : []
    if (rounds.length === 0) throw new Error('No hay ninguna vuelta que leer como sesión.')
    return readExamSession(readSettings(settingsDir()).enginePath, rounds)
  })

  // Reading the history touches no machine and computes no grade: it only
  // lists the artifacts already on disk.
  ipcMain.handle(IPC.listRuns, (_e, examPath: unknown) => {
    if (typeof examPath !== 'string' || !examPath) return []
    return listRuns(varDirOf(examPath))
  })

  // Writing the grades out. The renderer built the text and chose the scale;
  // here nothing is computed, only saved where the teacher points.
  ipcMain.handle(IPC.saveCsv, async (_e, name: unknown, text: unknown): Promise<string | null> => {
    if (typeof text !== 'string') throw new Error('No hay nada que exportar.')
    const suggested = typeof name === 'string' && name.trim() ? basename(name.trim()) : 'notas.csv'
    const result = await dialog.showSaveDialog({
      defaultPath: suggested,
      filters: [{ name: 'Notas', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return null
    writeFileSync(result.filePath, text, 'utf-8')
    return result.filePath
  })

  // The teacher's own classes. They touch no machine and no grade: this is
  // the address book of the course (ADR-0021).
  ipcMain.handle(IPC.listClasses, (): ClassGroup[] => readClasses(settingsDir()))

  // Whatever the renderer sends is read back through the model before it is
  // written, so a field that is not part of a class —a password above all—
  // never reaches the disk (ADR-0009, ADR-0021 §4).
  ipcMain.handle(IPC.saveClasses, (_e, classes: unknown): void => {
    if (!Array.isArray(classes)) throw new Error('No hay ninguna lista de clases que guardar.')
    const groups = classes.map(readGroup).filter((group): group is ClassGroup => group !== null)
    writeClasses(settingsDir(), groups)
  })

  ipcMain.handle(IPC.cancelRun, (): void => {
    session?.cancel()
  })
}

/** A window that closed mid-run must not turn a send into a crash. */
function send(sender: WebContents, channel: string, payload: unknown): void {
  if (!sender.isDestroyed()) sender.send(channel, payload)
}
