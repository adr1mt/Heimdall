import type { Session, SessionStatus, SessionStudent } from '../../../shared/session'
import { STUDENT_TEXT, dateText, scoreView } from './results'

/**
 * An exam session, said in the teacher's words.
 *
 * Nothing here computes a grade, picks a round or decides who has finished:
 * all of that comes from the engine's session view and is only read
 * (ADR-0020, principio 12). What this adds is the sentence around it, which is
 * the whole point of showing a session instead of the last round alone.
 */

/** The three states of a student in the session, in the teacher's words. */
export const SESSION_STATUS_TEXT: Record<SessionStatus, string> = {
  ACTIVE: 'En curso',
  FINISHED: 'Terminado',
  EXCLUDED: 'Excluido'
}

/** The session in one line: how many rounds and which span. */
export function sessionText(session: Session): string {
  const first = session.rounds[0]
  const last = session.rounds[session.rounds.length - 1]
  if (!first || !last) return 'Sin ninguna vuelta que leer.'
  if (session.rounds.length === 1) return `Una sola vuelta, la del ${dateText(first.finished_at)}`
  return `${session.rounds.length} vueltas del mismo examen, de la del ${dateText(first.finished_at)} a la del ${dateText(last.finished_at)}`
}

/** How the session stands, for the summary line. */
export function sessionTally(session: Session): {
  graded: number
  finished: number
  open: number
} {
  const graded = session.students.filter((s) => s.from_round > 0).length
  const finished = session.students.filter((s) => s.status === 'FINISHED').length
  return { graded, finished, open: session.students.length - graded }
}

/**
 * Where a student's grade comes from, or why there is none.
 *
 * The reason is the engine's own sentence when it wrote one: a student without
 * a whole round has no session grade, and saying so is not the same as a zero.
 */
export function fromRoundText(student: SessionStudent): string {
  if (student.from_round > 0) return `Sale de la vuelta ${student.from_round}`
  return student.reason ?? 'Todavía no tiene nota de la sesión'
}

/**
 * What the next round will do with this student. A finished student is not
 * corrected again, and the teacher sees why without opening anything.
 */
export function nextRoundText(student: SessionStudent): string | null {
  if (student.status === 'FINISHED') {
    return `Terminado: en la vuelta ${student.from_round} ya tenía el examen entero bien, así que las vueltas siguientes no lo corrigen.`
  }
  if (student.status === 'EXCLUDED') return 'El aula lo deja fuera del examen.'
  return null
}

/** One line per round: what it said about this student and whether it counts. */
export function roundLines(student: SessionStudent): string[] {
  return student.rounds.map((attempt) => {
    const score = scoreView(attempt.score)
    const grade = score.value == null ? 'sin nota' : `${score.value} sobre 100`
    const counts = attempt.counts ? ' · es la que cuenta' : ''
    return `Vuelta ${attempt.round} (${dateText(attempt.finished_at)}): ${STUDENT_TEXT[attempt.status].toLowerCase()}, ${grade}${counts}.`
  })
}
