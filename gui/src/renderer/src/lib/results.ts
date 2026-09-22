import type { AcademicStatus, Score, StudentStatus } from '../../../shared/events'
import type {
  Cause,
  CheckResult,
  PreviousAttempt,
  RemoteProcess,
  RunResult,
  Stream,
  StudentResult
} from '../../../shared/artifact'
import { toScale, type Scale } from './scale'

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
  /** The engine's number over 100, or null when there is none to show. */
  value: number | null
  /**
   * That same grade written in the teacher's scale, ready for the screen.
   *
   * The screen shows this and never `value`: the teacher marks out of ten and
   * reads these numbers out loud in front of a class. `value` stays for what
   * has to compare against the pass mark, which is set over the engine's 100.
   */
  text: string
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
export function scoreView(score: Score, scale: Scale): ScoreView {
  switch (score.status) {
    case 'COMPLETE':
      return {
        value: score.final_score,
        text: score.final_score === null ? '' : toScale(score.final_score, scale),
        kind: 'final',
        note: `sobre ${score.total} de peso, todo evaluado`
      }
    case 'INCOMPLETE':
      return {
        value: score.provisional_score,
        text: score.provisional_score === null ? '' : toScale(score.provisional_score, scale),
        kind: 'provisional',
        note: `sobre lo evaluado (${score.evaluable} de ${score.total}); falta ${score.unevaluated} por comprobar`
      }
    case 'NOT_EVALUATED':
      return { value: null, text: '', kind: 'none', note: 'no se pudo evaluar nada de este alumno' }
    case 'EXCLUDED':
      return { value: null, text: '', kind: 'none', note: 'excluido del examen' }
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

/**
 * What one student still has no result for, in the two units that are not
 * interchangeable: how many checks, and how much weight.
 *
 * They are kept apart on purpose (ADR-0018 §7). «Falta 1 de 12» reads as
 * nothing; if that one check is worth 4 of the 10 points of the exam, it is
 * not nothing. The weights come from the score the engine published, never
 * from adding anything up here.
 */
export interface Pending {
  student: StudentResult
  /** Checks with no academic result in this run. */
  checks: number
  /** Checks the PLAN gave this student. */
  checkTotal: number
  /** Weight with no academic result. */
  weight: number
  /** The PLAN's total weight: the denominator, the same for everybody. */
  weightTotal: number
}

/**
 * The students this run left with something unevaluated, in the PLAN's order.
 * An excluded student is not pending: they were never going to be evaluated.
 *
 * It counts every unevaluated check, weighted or not, because that is exactly
 * what a retry would execute again. A check of weight 0 is a diagnostic and
 * does not hold back a final grade, so a student can be here with a grade
 * already closed; the row says so by itself, because its missing weight is 0.
 */
export function pendingStudents(run: RunResult): Pending[] {
  const out: Pending[] = []
  for (const student of run.students) {
    if (student.status === 'EXCLUDED') continue
    const checks = student.checks.filter((c) => c.status === 'UNEVALUATED').length
    if (checks === 0) continue
    out.push({
      student,
      checks,
      checkTotal: student.checks.length,
      weight: student.score.unevaluated,
      weightTotal: student.score.total
    })
  }
  return out
}

/**
 * What a retry of this run would repeat: the students with something left and
 * the checks that would actually be executed again. Null when there is
 * nothing to repeat, which is what hides the offer instead of greying it out.
 *
 * Only UNEVALUATED is counted. A FAIL is never repeated automatically
 * (ADR-0018 §2).
 */
export function retryScope(run: RunResult): { students: number; checks: number } | null {
  const pending = pendingStudents(run)
  if (pending.length === 0) return null
  return {
    students: pending.length,
    checks: pending.reduce((total, p) => total + p.checks, 0)
  }
}

/**
 * Where this run's results come from, in one sentence. A teacher looking at
 * two screens a minute apart has to be able to tell which correction each
 * grade belongs to.
 */
export function originText(run: RunResult): string {
  const when = dateText(run.finished_at)
  if (!run.retry_of) return `Corrección del ${when}`
  const before = dateText(run.retry_of.run_at)
  return `Reintento del ${when} · repite ${run.retry_of.checks} comprobaciones de ${run.retry_of.students} alumnos de la corrección del ${before}`
}

/** What a check was in the run this one repeated, in one sentence. */
export function previousText(previous: PreviousAttempt): string {
  const what =
    previous.status === 'UNEVALUATED'
      ? `quedó sin evaluar: ${CAUSE_TEXT[previous.cause].toLowerCase()}`
      : `salió ${STATUS_TEXT[previous.status].toLowerCase()}`
  return `En el intento anterior ${what}.`
}

/** A timestamp of the artifact as the teacher reads dates. */
export function dateText(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
