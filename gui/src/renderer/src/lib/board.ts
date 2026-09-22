import type { RunState, StudentProgress } from './run-state'
import { gradeOf, type Scale } from './export'

/**
 * The board: the class in one screen, as it goes, for the projector.
 *
 * It exists because what the teacher needs on the wall is not what they need
 * on their own screen. Projected, the results screen hands the class the
 * address of a classmate's machine, the command that reached it and whatever
 * that machine printed. The board carries none of that: not because it covers
 * it up, but because it is built from four things per student —the name, how
 * far the correction got, the state and the grade the engine published— and a
 * machine is not one of them.
 *
 * Names are NOT covered. The teacher chose to correct a named class and needs
 * the names to talk to it.
 *
 * Nothing here decides a grade. The number comes from `gradeOf`, the same
 * function the exports use, so the wall and the grade sheet can never say
 * different things (principio 12).
 */

export type BoardState = 'waiting' | 'running' | 'finished' | 'excluded'

export interface BoardRow {
  studentId: string
  name: string
  state: BoardState
  /** Checks with a result so far. */
  done: number
  /** Checks the PLAN gave every student, fixed before any machine was touched. */
  total: number
  /** 0-100 over the PLAN's checks, never over what happened to arrive. */
  percent: number
  /** The final grade in the teacher's scale, or '' when there is none. */
  grade: string
  /** Why there is no grade, or '' when there is one. */
  note: string
}

export interface Board {
  rows: BoardRow[]
  /** Students the exam applies to: everybody but the excluded. */
  students: number
  /** Of those, how many are over. */
  finished: number
}

/**
 * The state of one student, in the three moments the class can read from the
 * back of the room. `student.end` is what makes it FINALIZADO: the engine said
 * it is over, and no count of checks is trusted to decide that.
 */
function stateOf(student: StudentProgress): BoardState {
  if (student.excluded) return 'excluded'
  if (student.status !== null) return 'finished'
  return student.done > 0 ? 'running' : 'waiting'
}

function percentOf(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((done / total) * 100))
}

/**
 * The board of a correction in flight, in the PLAN's order.
 *
 * The denominator is the PLAN's `check_count`, the same for everybody
 * (principio 7): a student whose machine is down still has a full bar to fill
 * and does not look finished because nothing arrived for them.
 */
export function board(state: RunState, scale: Scale): Board {
  const total = state.start?.plan.check_count ?? 0
  const rows = state.students.map((student) => {
    const boardState = stateOf(student)
    const { grade, note } = student.score
      ? gradeOf(student.score, scale)
      : { grade: '', note: '' }
    return {
      studentId: student.studentId,
      name: student.name,
      state: boardState,
      done: student.done,
      total,
      percent: boardState === 'excluded' ? 0 : percentOf(student.done, total),
      grade,
      note
    }
  })

  const counted = rows.filter((row) => row.state !== 'excluded')
  return {
    rows,
    students: counted.length,
    finished: counted.filter((row) => row.state === 'finished').length
  }
}
