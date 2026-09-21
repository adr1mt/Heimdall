import { execFile } from 'node:child_process'
import { MAX_ARTIFACT } from './artifact'
import { parseSession, type Session } from '../shared/session'

/**
 * Asking the engine what an exam session is worth.
 *
 * During an exam the class is corrected over and over, and the grade that
 * counts is the best round that came out whole. That rule lives in the engine
 * and only there (ADR-0020, principio 12). This runs `heimdall session`, which
 * opens the artifacts already on disk, touches no machine, writes nothing and
 * prints the view.
 */

/** Long enough for a whole morning of rounds; past it something is stuck. */
const TIMEOUT_MS = 30_000

/** The exit codes that still print a session: everybody graded, or not yet. */
const OK = 0
const PARTIAL = 3

/** What the engine printed, before it is read. */
export interface SessionOutput {
  code: number | null
  stdout: string
  stderr: string
  error: NodeJS.ErrnoException | null
}

/**
 * The argument vector. No shell, ever: a path travels as one argument with
 * whatever spaces it has inside it. The order is the order the rounds ran, and
 * it is kept as given: sorting it here would make «de qué vuelta sale» a
 * guess (ADR-0020 §5).
 */
export function sessionArgs(roundPaths: string[]): string[] {
  return ['session', ...roundPaths]
}

function runSession(enginePath: string, roundPaths: string[]): Promise<SessionOutput> {
  return new Promise((resolve) => {
    execFile(
      enginePath,
      sessionArgs(roundPaths),
      { timeout: TIMEOUT_MS, maxBuffer: MAX_ARTIFACT },
      (error, stdout, stderr) => {
        const err = error as NodeJS.ErrnoException | null
        const code = err && typeof err.code === 'number' ? err.code : err ? null : OK
        resolve({ code, stdout, stderr, error: err })
      }
    )
  })
}

/**
 * Reads what the engine says about the session.
 *
 * A session the engine refuses —rounds of different exams, a missing artifact—
 * arrives here as its own sentence and as nothing else: the caller shows the
 * reason and no grade at all, which is the only honest thing to show when the
 * rounds cannot be compared (principio 1).
 */
export function readSession(output: SessionOutput): Session {
  if (output.code === OK || output.code === PARTIAL) return parseSession(output.stdout)
  const said = output.stderr.trim().split('\n').pop()?.replace(/^heimdall session:\s*/, '')
  if (said) throw new Error(said)
  throw new Error(
    output.error
      ? `El motor no pudo leer la sesión de examen: ${output.error.message}`
      : 'El motor no pudo leer la sesión de examen.'
  )
}

export async function readExamSession(enginePath: string, roundPaths: string[]): Promise<Session> {
  return readSession(await runSession(enginePath, roundPaths))
}
