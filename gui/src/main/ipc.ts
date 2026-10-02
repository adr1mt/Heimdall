import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import {
  app,
  dialog,
  ipcMain,
  powerSaveBlocker,
  safeStorage,
  shell,
  type WebContents
} from 'electron'
import { IPC } from '../shared/ipc'
import { detectEngine } from './engine'
import { readArtifact } from './artifact'
import { consolidateChain } from './consolidate'
import { readExamSession } from './session'
import { listRuns, varDirOf } from './history'
import { backupRuns, listBackups, restoreBackups } from './backup'
import { RunSession, projectDirOf } from './run'
import { describeExam } from './describe'
import { secretRefsIn } from './secrets'
import { forgetPassword, rememberPassword, rememberedPassword, type Cipher } from './vault'
import { readSettings, writeSettings } from './store'
import { readClasses, writeClasses } from './classes'
import {
  createProjectAt,
  folderOf,
  forgetProject,
  openProjectAt,
  readRecents,
  rememberProject
} from './projects'
import { validateExam } from './validate'
import { writeGeneratedAula } from './aula'
import { aulaYaml } from '../shared/aula'
import { readGroup, type ClassGroup } from '../shared/classes'
import type { Description } from '../shared/describe'
import type {
  EngineStatus,
  ExamCheck,
  ExamModeRequest,
  OpenProject,
  RecentProject,
  RunClosed,
  RunRequest
} from '../shared/types'

const FILTERS: Record<'exam' | 'engine' | 'result', Electron.FileFilter[]> = {
  exam: [{ name: 'Examen', extensions: ['yaml', 'yml'] }],
  engine: [{ name: 'Motor', extensions: ['*'] }],
  result: [{ name: 'Resultado', extensions: ['json'] }]
}

/** Where the settings file lives: the app's own data directory. */
function settingsDir(): string {
  return app.getPath('userData')
}

/**
 * What the classroom password is kept with. A system that offers no
 * encryption keeps nothing: there is no plain-text fallback (ADR-0023).
 */
const cipher: Cipher = {
  available: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plain) => safeStorage.encryptString(plain),
  decrypt: (sealed) => safeStorage.decryptString(sealed)
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
  if (typeof raw.examPath !== 'string' || typeof raw.classId !== 'string') {
    throw new Error('Falta el examen o la clase.')
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
  return { examPath: raw.examPath, classId: raw.classId, secrets, retryFrom, sessionRounds }
}

/**
 * The saved class the correction is about.
 *
 * A class that is no longer there stops the correction with a sentence: going
 * on without it would mean correcting somebody else's list, and a list of
 * students is not something to guess at (principio 2).
 */
/**
 * The saved classes for a reading that is not a correction. A classes file
 * that cannot be read is already reported, loudly, in «Clases»; here it only
 * means the history names the files instead of the classes.
 */
function savedClasses(): ClassGroup[] {
  try {
    return readClasses(settingsDir())
  } catch {
    return []
  }
}

function groupOf(classId: unknown): ClassGroup {
  const group = readClasses(settingsDir()).find((other) => other.id === classId)
  if (!group) throw new Error('La clase que se iba a corregir ya no está guardada.')
  return group
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
    const key = kind === 'engine' || kind === 'result' ? kind : 'exam'
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: FILTERS[key] })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(IPC.pickDirectory, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  // The projects the teacher works with. They touch no machine and no grade:
  // a project is a folder with an exam in it, and this is the list of the
  // ones opened before (ADR-0021).
  ipcMain.handle(IPC.recentProjects, (): RecentProject[] => readRecents(settingsDir()))

  ipcMain.handle(IPC.openProject, (_e, dir: unknown): OpenProject => {
    if (typeof dir !== 'string' || !dir) throw new Error('No hay ninguna carpeta que abrir.')
    const project = openProjectAt(dir)
    rememberProject(settingsDir(), project)
    return project
  })

  ipcMain.handle(IPC.createProject, (_e, dir: unknown): OpenProject => {
    if (typeof dir !== 'string' || !dir) throw new Error('No hay ninguna carpeta donde crearlo.')
    const project = createProjectAt(dir)
    rememberProject(settingsDir(), project)
    return project
  })

  ipcMain.handle(IPC.removeRecent, (_e, dir: unknown): RecentProject[] => {
    if (typeof dir !== 'string' || !dir) return readRecents(settingsDir())
    return forgetProject(settingsDir(), dir)
  })

  // The exam of the open project, as text. The editor is the one that reads
  // it as an exam; here it is a file and nothing more.
  ipcMain.handle(IPC.readExam, (_e, examPath: unknown): string => {
    if (typeof examPath !== 'string' || !examPath) throw new Error('No hay ningún examen abierto.')
    return readFileSync(examPath, 'utf-8')
  })

  // Written atomically: a power cut in the middle must never leave half an
  // exam, which would be a class corrected against nothing.
  ipcMain.handle(IPC.writeExam, (_e, examPath: unknown, yaml: unknown): void => {
    if (typeof examPath !== 'string' || !examPath) throw new Error('No hay ningún examen abierto.')
    if (typeof yaml !== 'string') throw new Error('No hay ningún examen que guardar.')
    const tmp = `${examPath}.tmp`
    writeFileSync(tmp, yaml, 'utf-8')
    renameSync(tmp, examPath)
  })

  // Whether the engine accepts this exam. It resolves the PLAN and stops: no
  // machine is touched and nothing is written where the teacher can see it.
  ipcMain.handle(IPC.validateExam, (_e, request: unknown): Promise<ExamCheck> => {
    const raw = (request ?? {}) as { examPath?: unknown; classId?: unknown; yaml?: unknown }
    if (typeof raw.yaml !== 'string') throw new Error('No hay ningún examen que comprobar.')
    const shownAs = typeof raw.examPath === 'string' ? dirname(raw.examPath) : ''
    return validateExam(readSettings(settingsDir()).enginePath, raw.yaml, groupOf(raw.classId), shownAs)
  })

  // http(s) only: shell.openExternal opens any scheme the system knows, and a
  // link in the interface has no business launching programs.
  ipcMain.handle(IPC.openExternal, async (_e, url: unknown): Promise<void> => {
    const target = String(url)
    if (!/^https?:\/\//i.test(target)) throw new Error('Enlace no permitido.')
    await shell.openExternal(target)
  })

  // The credentials are read off the classroom this class WOULD produce, not
  // off a file on disk: it is the same text the correction will write, so the
  // interface never asks for a password the engine will not use.
  ipcMain.handle(IPC.secretRefs, (_e, classId: unknown): string[] =>
    secretRefsIn(aulaYaml(groupOf(classId)))
  )

  // The classroom password. It is the same on every machine and the same all
  // year, so it is typed once and remembered encrypted; the value travels to
  // the engine through stdin and nowhere else (ADR-0023).
  ipcMain.handle(IPC.rememberedPassword, (): string => rememberedPassword(settingsDir(), cipher))

  ipcMain.handle(IPC.rememberPassword, (_e, password: unknown): boolean =>
    rememberPassword(settingsDir(), cipher, typeof password === 'string' ? password : '')
  )

  ipcMain.handle(IPC.forgetPassword, (): void => forgetPassword(settingsDir()))

  ipcMain.handle(IPC.describe, (_e, paths: unknown): Description => {
    const raw = (paths ?? {}) as { examPath?: unknown }
    return { exam: typeof raw.examPath === 'string' ? describeExam(raw.examPath) : null }
  })

  // The folder of a file the teacher chose, and only a folder: shell.openPath
  // on a file executes whatever the desktop associates with it, and a
  // `.desktop` is a program.
  ipcMain.handle(IPC.openFolder, async (_e, path: unknown): Promise<void> => {
    const target = typeof path === 'string' ? folderOf(path) : null
    if (!target) throw new Error('No hay ninguna carpeta que abrir.')
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
    const { examPath, classId, secrets, retryFrom, sessionRounds } = readRunRequest(request)
    // Passes after the first carry no credentials: the teacher typed them
    // once, when the exam started, and they have not left this process.
    if (examMode && Object.keys(secrets).length === 0) Object.assign(secrets, examSecrets)
    const engine = readSettings(settingsDir()).enginePath
    // The classroom is rewritten from the class before every correction, so a
    // machine that moved arrives on its own (ADR-0022). The exam is checked
    // first: nothing is written into a folder that is not a project.
    const dir = projectDirOf(examPath)
    const className = writeGeneratedAula(dir, groupOf(classId))
    const target = { dir, className, retryFrom, sessionRounds }
    const sender = event.sender

    session = new RunSession(engine, target, secrets, {
      onEvent: (engineEvent) => send(sender, IPC.runEvent, engineEvent),
      onClose: (exitCode, stderr) => {
        session = null
        // The grades leave the exam's folder the moment they exist. It never
        // throws and it never blocks: a copy that fails must not turn a
        // finished correction into an error (T113).
        const closed: RunClosed = { exitCode, stderr }
        send(sender, IPC.runClosed, closed)
        void backupRuns(settingsDir(), examPath).then(report=> {
          if(report.failures.length) send(sender,IPC.backupWarning,`La corrección terminó, pero falló la copia de seguridad (${report.failures.length} incidencias). Las notas originales siguen en ${dir}. Revisa el destino de las copias. ${report.failures[0]}`)
        }).catch(error=>send(sender,IPC.backupWarning,`No se pudo hacer la copia de seguridad: ${String(error)}`))
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
    return listRuns(varDirOf(examPath), savedClasses())
  })

  // The safety copies. Listing them reads only the app's own data directory.
  ipcMain.handle(IPC.listBackups, (_e, examPath: unknown) => {
    if (typeof examPath !== 'string' || !examPath) return []
    return listBackups(settingsDir(), examPath)
  })

  // Restoring only ever adds corrections back: a result already in the
  // exam's folder is never overwritten, so no grade already saved goes down.
  ipcMain.handle(IPC.restoreBackups, (_e, examPath: unknown) => {
    if (typeof examPath !== 'string' || !examPath) {
      throw new Error('No hay ningún examen abierto que restaurar.')
    }
    return restoreBackups(settingsDir(), examPath)
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
