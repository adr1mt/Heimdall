import { CONTRACT_VERSION, type EngineEvent, type RunEndEvent, type RunStartEvent, type Score, type StudentStatus } from '../../../shared/events'
import type { RunClosed } from '../../../shared/types'

/**
 * What the screen knows about a correction. It is built only from the stream,
 * which carries progress and never a source of truth the artifact lacks: the
 * grades shown here are the ones the engine already published in `score`.
 */
export type RunPhase = 'idle' | 'starting' | 'running' | 'finished'

export interface StudentProgress {
  studentId: string
  name: string
  excluded: boolean
  /** Checks finished so far. */
  done: number
  pass: number
  fail: number
  unevaluated: number
  /** Set when the student is over. */
  status: StudentStatus | null
  score: Score | null
}

export interface RunState {
  phase: RunPhase
  /** The PLAN, fixed before a machine was touched. */
  start: RunStartEvent | null
  end: RunEndEvent | null
  /** Checks finished, across the whole class. */
  done: number
  students: StudentProgress[]
  /** True once cancelling was asked for and until the engine is gone. */
  cancelling: boolean
  /** One sentence for the teacher when something went wrong. */
  problem: string | null
}

export function emptyRunState(): RunState {
  return {
    phase: 'idle',
    start: null,
    end: null,
    done: 0,
    students: [],
    cancelling: false,
    problem: null
  }
}

/** 0-100 over the checks the PLAN expects, or null while the total is unknown. */
export function runPercent(state: RunState): number | null {
  const expected = state.start?.expected_checks ?? 0
  if (expected <= 0) return null
  return Math.min(100, Math.round((state.done / expected) * 100))
}

function withStudent(
  state: RunState,
  studentId: string,
  change: (student: StudentProgress) => StudentProgress
): StudentProgress[] {
  return state.students.map((s) => (s.studentId === studentId ? change(s) : s))
}

/**
 * Folds one event into the state. Everything the bar shows comes from here, so
 * it is pure and the tests can replay a whole run without an engine.
 */
export function applyEvent(state: RunState, event: EngineEvent): RunState {
  switch (event.event) {
    case 'run.start': {
      if (event.contract_version !== CONTRACT_VERSION) {
        return {
          ...state,
          phase: 'finished',
          problem: `Este motor habla la versión ${event.contract_version} del contrato y la aplicación entiende la ${CONTRACT_VERSION}. Actualiza la aplicación o el motor.`
        }
      }
      return {
        ...state,
        phase: 'running',
        start: event,
        done: 0,
        problem: null,
        students: event.students.map((s) => ({
          studentId: s.student_id,
          name: s.name,
          excluded: s.excluded,
          done: 0,
          pass: 0,
          fail: 0,
          unevaluated: 0,
          status: s.excluded ? 'EXCLUDED' : null,
          score: null
        }))
      }
    }

    case 'student.start':
      return state

    case 'check.end': {
      // A check of a student the PLAN did not announce would mean the stream
      // and the PLAN disagree; it still counts towards the bar, because the
      // engine did the work.
      return {
        ...state,
        done: state.done + 1,
        students: withStudent(state, event.student_id, (s) => ({
          ...s,
          done: s.done + 1,
          pass: s.pass + (event.status === 'PASS' ? 1 : 0),
          fail: s.fail + (event.status === 'FAIL' ? 1 : 0),
          unevaluated: s.unevaluated + (event.status === 'UNEVALUATED' ? 1 : 0)
        }))
      }
    }

    case 'student.end':
      return {
        ...state,
        students: withStudent(state, event.student_id, (s) => ({
          ...s,
          status: event.status,
          score: event.score
        }))
      }

    case 'run.end':
      return { ...state, phase: 'finished', end: event, cancelling: false }
  }
}

/**
 * The engine process is gone. A run that never saw `run.end` is unfinished,
 * whatever the exit code says (contract §4): saying so is the difference
 * between a teacher who knows to run it again and one who publishes half a
 * class's grades.
 */
export function applyClosed(state: RunState, closed: RunClosed): RunState {
  if (state.end) return { ...state, phase: 'finished', cancelling: false }

  const detail = closed.stderr.trim()
  const reason =
    closed.exitCode === 2
      ? 'La configuración no es válida, así que no se ha tocado ninguna máquina.'
      : closed.exitCode === null
        ? 'No se ha podido arrancar el motor.'
        : `El motor ha terminado sin cerrar la ejecución (código ${closed.exitCode}).`
  return {
    ...state,
    phase: 'finished',
    cancelling: false,
    problem: detail ? `${reason}\n\n${detail}` : reason
  }
}
