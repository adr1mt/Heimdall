// Types that cross the IPC boundary. The evaluation model itself lives in
// events.ts, which follows docs/design/09-CONTRATO-GUI.md.

import type { EngineEvent } from './events'

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
  pickFile: (kind: 'exam' | 'class' | 'engine') => Promise<string | null>
  openExternal: (url: string) => Promise<void>
  /** Credential names the chosen classroom asks for. */
  secretRefs: (classPath: string) => Promise<string[]>
  startRun: (request: RunRequest) => Promise<void>
  cancelRun: () => Promise<void>
  /** Subscribes to the stream. Returns the unsubscribe function. */
  onRunEvent: (listener: (event: EngineEvent) => void) => () => void
  onRunClosed: (listener: (closed: RunClosed) => void) => () => void
}
