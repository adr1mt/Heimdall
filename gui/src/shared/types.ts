// Types that cross the IPC boundary. The evaluation model itself lives in
// events.ts, which follows docs/design/09-CONTRATO-GUI.md.

import type { EngineEvent } from './events'
import type { RunResult } from './artifact'
import type { Description } from './describe'
import type { Consolidation } from './consolidation'
import type { Session } from './session'
import type { RunSummary } from './history'

/** Result of locating the engine and asking it for its version. */
export interface EngineStatus {
  /** The binary exists, answers and identifies itself as Heimdall. */
  found: boolean
  /** The path it was called with. */
  path: string
  /** Engine version, when it could be read. */
  version: string | null
  /** Why it cannot be used, in Spanish and for the teacher. */
  problem: string | null
}

/** What the renderer asks for when the teacher presses «Corregir». */
export interface RunRequest {
  examPath: string
  classPath: string
  /** Credential name → value. It is never written anywhere (ADR-0009). */
  secrets: Record<string, string>
  /**
   * Path of a previous artifact whose unevaluated checks are repeated. The
   * engine decides what that means; the interface only names the file
   * (ADR-0018).
   */
  retryFrom?: string
  /**
   * Artifacts of the earlier rounds of this exam session, oldest first. The
   * engine reads them to leave out whoever already finished; the interface
   * only names the files and never decides who is done (ADR-0020).
   */
  sessionRounds?: string[]
}

/** What the renderer asks for when exam mode is switched. */
export interface ExamModeRequest {
  active: boolean
  /**
   * Credential name → value, sent once when the mode starts. It is never
   * written anywhere and it dies with the mode (ADR-0009).
   */
  secrets?: Record<string, string>
}

/**
 * The engine process is gone. A run that never saw `run.end` is unfinished,
 * whatever this says (contract §4).
 */
export interface RunClosed {
  /** null when the engine could not even be launched. */
  exitCode: number | null
  /** What the engine wrote on stderr, capped. Empty when it said nothing. */
  stderr: string
}

export interface HeimdallApi {
  detectEngine: () => Promise<EngineStatus>
  getEnginePath: () => Promise<string>
  setEnginePath: (path: string) => Promise<EngineStatus>
  pickFile: (kind: 'exam' | 'class' | 'engine' | 'result') => Promise<string | null>
  openExternal: (url: string) => Promise<void>
  /** Credential names the chosen classroom asks for. */
  secretRefs: (classPath: string) => Promise<string[]>
  /**
   * The names the teacher gave the exam and the classroom, for the screen. A
   * file that cannot be read has no name here and its error, whole, when the
   * correction starts.
   */
  describe: (paths: { examPath: string | null; classPath: string | null }) => Promise<Description>
  /** Opens the folder a chosen file lives in, in the system file manager. */
  openFolder: (path: string) => Promise<void>
  startRun: (request: RunRequest) => Promise<void>
  /** Reads the canonical artifact of a finished run. */
  readArtifact: (path: string) => Promise<RunResult>
  /**
   * Asks the engine what the chain this artifact belongs to looks like as a
   * whole. It is read-only, and the grade in it is the engine's (ADR-0019).
   */
  consolidate: (path: string) => Promise<Consolidation>
  /**
   * Asks the engine what the rounds of an exam session are worth: the best
   * whole round of each student, which round it was and who has finished. It
   * is read-only and the grades in it are the engine's (ADR-0020).
   */
  session: (roundPaths: string[]) => Promise<Session>
  /** The past runs of the project the exam belongs to, newest first. */
  listRuns: (examPath: string) => Promise<RunSummary[]>
  /**
   * Writes the grades the renderer already built where the teacher says.
   * Returns the path, or null if they cancelled the dialog.
   */
  saveCsv: (name: string, text: string) => Promise<string | null>
  /**
   * Turns exam mode on or off in the main process: it keeps the computer
   * awake, makes closing the window ask first, and holds the credentials of
   * the class for as long as the chain lasts so each pass does not have to
   * ask for them again. Turning it off wipes them.
   */
  setExamMode: (request: ExamModeRequest) => Promise<void>
  cancelRun: () => Promise<void>
  /** Subscribes to the stream. Returns the unsubscribe function. */
  onRunEvent: (listener: (event: EngineEvent) => void) => () => void
  onRunClosed: (listener: (closed: RunClosed) => void) => () => void
}
