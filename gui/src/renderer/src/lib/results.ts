import type { AcademicStatus, Score, StudentStatus } from '../../../shared/events'
import type {
  Cause,
  CheckResult,
  RemoteProcess,
  RunResult,
  Stream,
  StudentResult
} from '../../../shared/artifact'

/**
 * The technical axis in words the teacher can act on. Every cause of the model
 * is here: a cause with no sentence would reach the screen as an empty space
 * where the reason should be.
 */
export const CAUSE_TEXT: Record<Cause, string> = {
  NONE: 'Sin problema técnico',
  CONNECT_FAILED: 'No se pudo conectar con la máquina',
  AUTH_FAILED: 'La máquina rechazó las credenciales',
  TIMEOUT: 'El comando no terminó a tiempo',
  CONNECTION_LOST: 'La conexión se cortó a mitad',
  NOT_RUN: 'No se llegó a ejecutar',
  CANCELLED: 'La corrección se detuvo antes de llegar aquí',
  OUTPUT_OVERFLOW: 'El comando sacó más salida de la que se puede leer',
  ENGINE_ERROR: 'Fallo del propio Heimdall'
}

export const STATUS_TEXT: Record<AcademicStatus, string> = {
  PASS: 'Bien',
  FAIL: 'Mal',
  UNEVALUATED: 'Sin evaluar'
}

export const STUDENT_TEXT: Record<StudentStatus, string> = {
  OK: 'Evaluado',
  PARTIAL: 'Incompleto',
  NOT_EVALUATED: 'Sin evaluar',
  EXCLUDED: 'Excluido'
}

/**
 * Whether a process may still be alive on the student's machine, and what the
 * teacher has to do about it. A finished process says nothing, because there
 * is nothing to do; the other two are work the teacher would not know about
 * otherwise.
 */
export const REMOTE_TEXT: Record<RemoteProcess, string | null> = {
  FINISHED: null,
  KILLED_REMOTE:
    'El comando se mató en la máquina del alumno; puede haber quedado un proceso suelto.',
  UNKNOWN: 'No se sabe si el comando sigue vivo en la máquina del alumno.'
}

/** How a grade is allowed to be shown. */
export interface ScoreView {
  /** The number, or null when there is none to show. */
  value: number | null
  /** What that number is. `none` means there is no grade at all. */
  kind: 'final' | 'provisional' | 'none'
  /** The sentence that goes with it, always. */
  note: string
}

/**
 * Turns a Score into what may appear on screen.
 *
 * The rule that matters: while a single check is unevaluated there is no final
 * grade, and the provisional one is never shown as if it were (ADR-0006). A
 * student nobody could reach gets no number at all, because a 0 would read as
 * "did it wrong" instead of "we could not look" (principio 3).
 */
export function scoreView(score: Score): ScoreView {
  switch (score.status) {
    case 'COMPLETE':
      return {
        value: score.final_score,
        kind: 'final',
        note: `sobre ${score.total} de peso, todo evaluado`
      }
    case 'INCOMPLETE':
      return {
        value: score.provisional_score,
        kind: 'provisional',
        note: `sobre lo evaluado (${score.evaluable} de ${score.total}); falta ${score.unevaluated} por comprobar`
      }
    case 'NOT_EVALUATED':
      return { value: null, kind: 'none', note: 'no se pudo evaluar nada de este alumno' }
    case 'EXCLUDED':
      return { value: null, kind: 'none', note: 'excluido del examen' }
  }
}

/** What the teacher narrowed the matrix to. */
export interface Filters {
  /** Free text over the student's name and the check's id, group and text. */
  text: string
  status: AcademicStatus | 'ALL'
  cause: Cause | 'ALL'
}

export const NO_FILTERS: Filters = { text: '', status: 'ALL', cause: 'ALL' }

export function hasFilters(filters: Filters): boolean {
  return filters.text.trim() !== '' || filters.status !== 'ALL' || filters.cause !== 'ALL'
}

function matchesText(haystack: string[], needle: string): boolean {
  const text = needle.trim().toLowerCase()
  if (!text) return true
  return haystack.some((value) => value.toLowerCase().includes(text))
}

/** Whether one check survives the filters, for one student. */
export function checkMatches(student: StudentResult, check: CheckResult, filters: Filters): boolean {
  if (filters.status !== 'ALL' && check.status !== filters.status) return false
  if (filters.cause !== 'ALL' && check.cause !== filters.cause) return false
  return matchesText(
    [student.name, student.student_id, check.check_id, check.group, check.description],
    filters.text
  )
}

/**
 * The students the matrix shows, each with the checks that survived. A student
 * with nothing left drops out of the list, so a filter answers a question
 * instead of leaving rows of empty cells behind.
 */
export function filterRun(
  run: RunResult,
  filters: Filters
): { student: StudentResult; checks: CheckResult[] }[] {
  const rows = run.students.map((student) => ({
    student,
    checks: student.checks.filter((check) => checkMatches(student, check, filters))
  }))
  if (!hasFilters(filters)) return rows
  return rows.filter((row) => row.checks.length > 0)
}

/** The causes actually present in a run, so the filter offers only those. */
export function causesIn(run: RunResult): Cause[] {
  const seen = new Set<Cause>()
  for (const student of run.students) {
    for (const check of student.checks) {
      if (check.cause !== 'NONE') seen.add(check.cause)
    }
  }
  return [...seen].sort()
}

/**
 * What was cut off a stream, in bytes the teacher can compare. Hiding this
 * would hide that the exam asks for more output than it can read.
 */
export function truncationNote(stream: Stream): string | null {
  if (!stream.truncated) return null
  return `Cortado: se guardan ${formatBytes(stream.bytes)} de los ${formatBytes(stream.bytes_total)} que sacó el comando.`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** The tally of one student's checks, for the row header. */
export function tally(checks: CheckResult[]): { pass: number; fail: number; unevaluated: number } {
  return {
    pass: checks.filter((c) => c.status === 'PASS').length,
    fail: checks.filter((c) => c.status === 'FAIL').length,
    unevaluated: checks.filter((c) => c.status === 'UNEVALUATED').length
  }
}
