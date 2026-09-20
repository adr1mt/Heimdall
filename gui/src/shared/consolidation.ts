// A chain of corrections read as one, as the GUI reads it.
//
// It is what `heimdall consolidate` prints: a view over artifacts that already
// exist, never an artifact itself (ADR-0019). The grade in it was computed by
// the engine with the same pure function a single run uses; nothing here adds
// anything up, and the interface may not either.

import type { AcademicStatus, PlanSummary, RunStatus, Score, StudentStatus } from './events'
import type { Cause, PreviousAttempt } from './artifact'

/** The version of the consolidated view this build knows how to read. */
export const CONSOLIDATION_VERSION = 1

/** One run of the chain, so every result can point at it. */
export interface ConsolidatedRun {
  run_id: string
  artifact: string
  started_at: string
  finished_at: string
  status: RunStatus
}

/**
 * One check as the chain leaves it. It carries no execution and no assertion:
 * that evidence stays in the artifact of the run named by `from_run`, which is
 * where Histórico opens it.
 */
export interface ConsolidatedCheck {
  check_id: string
  group: string
  description: string
  weight: number
  status: AcademicStatus
  cause: Cause
  detail?: string
  /** The run this result was taken from, and when it finished. */
  from_run: string
  from_run_at: string
  /** What happened to this same check before, newest first. A record, never a result. */
  attempts?: PreviousAttempt[]
}

export interface ConsolidatedStudent {
  student_id: string
  name: string
  moodle_id?: string
  status: StudentStatus
  score: Score
  checks: ConsolidatedCheck[]
}

export interface Consolidation {
  consolidation_version: number
  kind: string
  plan_hash: string
  plan: PlanSummary
  /** The chain, newest first. */
  runs: ConsolidatedRun[]
  students: ConsolidatedStudent[]
}

/**
 * Reads what the engine printed. A version it does not know, or a document
 * that is not a consolidation, is refused instead of guessed at: a run read as
 * a chain would show grades that nobody computed for it.
 */
export function parseConsolidation(text: string): Consolidation {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('El motor no devolvió una consolidación legible.')
  }
  if (typeof value !== 'object' || value === null) {
    throw new Error('El motor no devolvió una consolidación legible.')
  }
  const chain = value as Partial<Consolidation>
  if (chain.kind !== 'consolidation') {
    throw new Error('Eso no es una cadena de correcciones consolidada.')
  }
  if (chain.consolidation_version !== CONSOLIDATION_VERSION) {
    throw new Error(
      `La consolidación está escrita en la versión ${String(chain.consolidation_version)} y la aplicación entiende la ${CONSOLIDATION_VERSION}.`
    )
  }
  if (!Array.isArray(chain.students) || !Array.isArray(chain.runs) || !chain.plan) {
    throw new Error('La consolidación está incompleta.')
  }
  return chain as Consolidation
}
