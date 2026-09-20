/**
 * Exam mode: the application corrects the class again and again while the
 * practice lasts, so the teacher does not have to press anything.
 *
 * The decisions live here, as pure functions on a plain value, for one
 * reason: the rule that matters —never two engines at once— has to be
 * testable without an Electron window. The timer that calls these functions
 * is in App.tsx.
 *
 * The chain is scheduled from the END of a pass, never from its start: an
 * interval that expired while the engine was still working would otherwise
 * queue a second one behind it.
 */

import type { RunPhase } from './run-state'

/** Where exam mode is right now. */
export interface ExamMode {
  /** The teacher turned it on. It stays on between passes. */
  active: boolean
  /** Minutes between the end of one pass and the start of the next. */
  everyMinutes: number
  /** When the next pass is due, in epoch ms. Null while one is in flight. */
  nextAt: number | null
  /** Passes started since it was turned on, for the sentence on screen. */
  passes: number
}

/** What the teacher can pick, in minutes. */
export const EXAM_INTERVALS = [5, 10, 15, 30] as const

export const EXAM_OFF: ExamMode = { active: false, everyMinutes: 10, nextAt: null, passes: 0 }

/** Turns it on and makes the first pass due right away. */
export function examStarted(everyMinutes: number, now: number): ExamMode {
  return { active: true, everyMinutes, nextAt: now, passes: 0 }
}

/** Turns it off. Nothing is pending after this. */
export function examStopped(exam: ExamMode): ExamMode {
  return { ...exam, active: false, nextAt: null }
}

/**
 * Whether the timer should launch a pass now.
 *
 * `nextAt === null` means either a pass is in flight or exam mode is off, and
 * in both cases nothing is launched. The phase is checked as well: the two
 * conditions are redundant on purpose, because a single missed reset here
 * would mean two engines writing into the same var/.
 */
export function shouldStartPass(exam: ExamMode, phase: RunPhase, now: number): boolean {
  if (!exam.active || exam.nextAt === null) return false
  if (phase === 'starting' || phase === 'running') return false
  return now >= exam.nextAt
}

/** A pass has been launched: nothing is due until it ends. */
export function passStarted(exam: ExamMode): ExamMode {
  return { ...exam, nextAt: null, passes: exam.passes + 1 }
}

/** A pass has ended. The next one is due a whole interval later. */
export function passFinished(exam: ExamMode, now: number): ExamMode {
  if (!exam.active) return exam
  return { ...exam, nextAt: now + exam.everyMinutes * 60_000 }
}

/** Seconds left until the next pass, or null when none is due. */
export function secondsLeft(exam: ExamMode, now: number): number | null {
  if (!exam.active || exam.nextAt === null) return null
  return Math.max(0, Math.ceil((exam.nextAt - now) / 1000))
}
