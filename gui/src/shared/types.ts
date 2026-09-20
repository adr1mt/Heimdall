// Types that cross the IPC boundary. The evaluation model itself lives in
// events.ts, which follows docs/design/09-CONTRATO-GUI.md.

import type { EngineEvent } from './events'
import type { RunResult } from './artifact'
import type { Consolidation } from './consolidation'
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
  startRun: (request: RunRequest) => Promise<void>
  /** Reads the canonical artifact of a finished run. */
  readArtifact: (path: string) => Promise<RunResult>
  /**
   * Asks the engine what the chain this artifact belongs to looks like as a
   * whole. It is read-only, and the grade in it is the engine's (ADR-0019).
   */
  consolidate: (path: string) => Promise<Consolidation>
  /** The past runs of the project the exam belongs to, newest first. */
  listRuns: (examPath: string) => Promise<RunSummary[]>
  /**
   * Writes the grades the renderer already built where the teacher says.
   * Returns the path, or null if they cancelled the dialog.
   */
  saveCsv: (name: string, text: string) => Promise<string | null>
  cancelRun: () => Promise<void>
  /** Subscribes to the stream. Returns the unsubscribe function. */
  onRunEvent: (listener: (event: EngineEvent) => void) => () => void
  onRunClosed: (listener: (closed: RunClosed) => void) => () => void
}
