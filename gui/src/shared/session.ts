// An exam session as the GUI reads it: the rounds of one exam read as one
// thing.
//
// It is what `heimdall session` prints. Nothing here is computed by the
// application: which round each grade comes from, who has finished and what
// every round said are the engine's answers (principio 12, ADR-0020). A
// session is not a chain of retries and it is not an artifact either: it is a
// view over rounds that each keep their own.

import type { PlanSummary, RunStatus, Score, StudentStatus } from './events'

/** The version of the session view this build knows how to read. */
export const SESSION_VERSION = 1

/**
 * Where a student stands in the session. It answers one question: does the
 * next round still have to correct them? Whether they have a grade yet is a
 * different question, answered by the score and by `from_round`.
 */
export type SessionStatus = 'ACTIVE' | 'FINISHED' | 'EXCLUDED'

/** One round of the session, so every grade can point at it. */
export interface SessionRoundRef {
  /** 1-based, in the order the rounds ran. */
  round: number
  run_id: string
  artifact: string
  started_at: string
  finished_at: string
  status: RunStatus
}

/**
 * One student in one round. It carries no checks and no output: that evidence
 * lives in that round's own artifact, which Histórico opens.
 */
export interface SessionAttempt {
  round: number
  run_id: string
  finished_at: string
  status: StudentStatus
  score: Score
  /** True for the one round the session grade came from. */
  counts: boolean
}

export interface SessionStudent {
  student_id: string
  name: string
  moodle_id?: string
  status: SessionStatus
  /** The grade of the best complete round. 0 in `from_round` means none yet. */
  score: Score
  from_round: number
  from_run_id?: string
  /** Why there is no session grade, in the engine's words. */
  reason?: string
  /** What every round said, oldest first. A record, never a result. */
  rounds: SessionAttempt[]
}

export interface Session {
  session_version: number
  kind: string
  plan_hash: string
  plan: PlanSummary
  rounds: SessionRoundRef[]
  students: SessionStudent[]
}

/**
 * Reads what the engine printed. A version it does not know, or a document
 * that is not a session, is refused instead of guessed at: a chain read as a
 * session would put the wrong round's grade on the screen.
 */
export function parseSession(text: string): Session {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('El motor no devolvió una sesión legible.')
  }
  if (typeof value !== 'object' || value === null) {
    throw new Error('El motor no devolvió una sesión legible.')
  }
  const session = value as Partial<Session>
  if (session.kind !== 'session') {
    throw new Error('Eso no es una sesión de examen.')
  }
  if (session.session_version !== SESSION_VERSION) {
    throw new Error(
      `La sesión está escrita en la versión ${String(session.session_version)} y la aplicación entiende la ${SESSION_VERSION}.`
    )
  }
  if (!Array.isArray(session.students) || !Array.isArray(session.rounds) || !session.plan) {
    throw new Error('La sesión está incompleta.')
  }
  return session as Session
}
