import { execFile } from 'node:child_process'
import { MAX_ARTIFACT } from './artifact'
import { parseConsolidation, type Consolidation } from '../shared/consolidation'

/**
 * Asking the engine to read a chain of corrections as one.
 *
 * The grade of a student who was left half-evaluated on Tuesday and finished
 * on Wednesday is closed here, by the engine and only by the engine
 * (ADR-0019). This touches no machine, writes no file and computes nothing: it
 * runs `heimdall consolidate`, which is read-only, and hands the result over.
 */

/** Long enough for fifty artifacts of a class; past it something is stuck. */
const TIMEOUT_MS = 30_000

/** The exit codes that still print a consolidation: everything evaluated, or not. */
const OK = 0
const PARTIAL = 3

/** What the engine printed, before it is read. */
export interface ConsolidateOutput {
  code: number | null
  stdout: string
  stderr: string
  error: NodeJS.ErrnoException | null
}

/**
 * The argument vector. No shell, ever: the path of an artifact travels as one
 * argument with whatever spaces it has inside it.
 */
export function consolidateArgs(artifactPath: string): string[] {
  return ['consolidate', artifactPath]
}

function runConsolidate(enginePath: string, artifactPath: string): Promise<ConsolidateOutput> {
  return new Promise((resolve) => {
    execFile(
      enginePath,
      consolidateArgs(artifactPath),
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
 * Reads what the engine says about a chain.
 *
 * A chain the engine refuses — runs of different exams, a missing artifact —
 * arrives here as its own sentence and as nothing else: the caller shows the
 * reason and no grade at all, which is the only honest thing to show when the
 * denominator is in doubt (principio 1).
 */
export function readConsolidation(output: ConsolidateOutput): Consolidation {
  if (output.code === OK || output.code === PARTIAL) return parseConsolidation(output.stdout)
  const said = output.stderr.trim().split('\n').pop()?.replace(/^heimdall consolidate:\s*/, '')
  if (said) throw new Error(said)
  throw new Error(
    output.error
      ? `El motor no pudo leer la cadena de correcciones: ${output.error.message}`
      : 'El motor no pudo leer la cadena de correcciones.'
  )
}

export async function consolidateChain(
  enginePath: string,
  artifactPath: string
): Promise<Consolidation> {
  return readConsolidation(await runConsolidate(enginePath, artifactPath))
}
