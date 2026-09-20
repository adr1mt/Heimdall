import type { Consolidation, ConsolidatedCheck } from '../../../shared/consolidation'
import type { PreviousAttempt } from '../../../shared/artifact'
import { CAUSE_TEXT, STATUS_TEXT, dateText } from './results'

/**
 * A chain of corrections, said in the teacher's words.
 *
 * Nothing here computes a grade: the numbers come from the engine's
 * consolidation and are only read (ADR-0019). What this adds is where each
 * result comes from, which is the whole point of showing a chain instead of
 * the last correction alone.
 */

/** The chain in one sentence: how many corrections and which span. */
export function chainText(chain: Consolidation): string {
  const newest = chain.runs[0]
  const oldest = chain.runs[chain.runs.length - 1]
  if (!newest || !oldest) return 'Sin ninguna corrección que leer.'
  if (chain.runs.length === 1) return `Una sola corrección, la del ${dateText(newest.finished_at)}`
  return `${chain.runs.length} correcciones leídas juntas, de la del ${dateText(oldest.finished_at)} a la del ${dateText(newest.finished_at)}`
}

/** Which correction one result comes from. */
export function fromRunText(check: ConsolidatedCheck): string {
  return `Sale de la corrección del ${dateText(check.from_run_at)}`
}

/** What happened to the same check before, one line per attempt, newest first. */
export function attemptsText(attempts: PreviousAttempt[] | undefined): string[] {
  return (attempts ?? []).map((attempt) => {
    const what =
      attempt.status === 'UNEVALUATED'
        ? `quedó sin evaluar: ${CAUSE_TEXT[attempt.cause].toLowerCase()}`
        : `salió ${STATUS_TEXT[attempt.status].toLowerCase()}`
    return `El ${dateText(attempt.finished_at)} ${what}.`
  })
}

/** How many students the chain closes with a final grade, for the summary line. */
export function chainTally(chain: Consolidation): { closed: number; open: number } {
  const closed = chain.students.filter((s) => s.score.status === 'COMPLETE').length
  return { closed, open: chain.students.length - closed }
}
