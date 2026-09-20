import type { RunResult, StudentResult } from '../../../shared/artifact'
import { dateText } from './results'

/**
 * Taking the grades out of the application, in the only two forms that are
 * not an invention: the number the engine published, converted to the scale
 * the teacher marks in, or the plain statement that there is no grade.
 *
 * The conversion lives here and nowhere else. The engine publishes 0-100 and
 * the raw numbers, and never the teacher's scale (architecture.md §8); the
 * artifact is read and never written, so exporting cannot change a single
 * grade on disk.
 */

/** A scale the teacher marks in. */
export interface Scale {
  id: ScaleId
  /** What it is called on screen. */
  label: string
  /** The top mark. */
  max: number
  /** Decimals the mark is written with. */
  decimals: number
}

export type ScaleId = 'ten' | 'hundred'

/**
 * The two scales in use. There is no free-form scale: an arbitrary maximum
 * invites a conversion nobody can check afterwards, and these are the two the
 * marks are actually recorded in.
 */
export const SCALES: Record<ScaleId, Scale> = {
  ten: { id: 'ten', label: '0 a 10', max: 10, decimals: 1 },
  hundred: { id: 'hundred', label: '0 a 100', max: 100, decimals: 0 }
}

export const DEFAULT_SCALE: ScaleId = 'ten'

export function scaleOf(id: string | null | undefined): Scale {
  return id === 'hundred' ? SCALES.hundred : SCALES.ten
}

/** The engine's 0-100 in the teacher's scale, written as it is marked. */
export function toScale(score100: number, scale: Scale): string {
  const factor = 10 ** scale.decimals
  const value = Math.round((score100 * scale.max) / 100 * factor) / factor
  return value.toFixed(scale.decimals).replace('.', ',')
}

/** One line of the export: a student, with a grade or with the reason there is none. */
export interface GradeRow {
  name: string
  studentId: string
  moodleId: string
  /** The student's state, in the teacher's words. */
  state: string
  /** The final grade in the chosen scale, or '' when there is none. */
  grade: string
  /** Why there is no grade, or '' when there is one. */
  note: string
  pass: number
  fail: number
  unevaluated: number
}

/**
 * What one student exports.
 *
 * A student without a final grade exports an empty grade and the reason, never
 * a number: a provisional grade in a spreadsheet is indistinguishable from a
 * closed one, and a 0 for a machine nobody could reach would be a fail the
 * student did not earn (principio 3, ADR-0006).
 */
export function gradeRow(student: StudentResult, scale: Scale): GradeRow {
  const checks = student.checks
  const row: GradeRow = {
    name: student.name,
    studentId: student.student_id,
    moodleId: student.moodle_id ?? '',
    state: STATE_TEXT[student.status],
    grade: '',
    note: '',
    pass: checks.filter((c) => c.status === 'PASS').length,
    fail: checks.filter((c) => c.status === 'FAIL').length,
    unevaluated: checks.filter((c) => c.status === 'UNEVALUATED').length
  }

  const score = student.score
  if (score.status === 'COMPLETE' && score.final_score !== null) {
    row.grade = toScale(score.final_score, scale)
    return row
  }
  row.note =
    score.status === 'INCOMPLETE'
      ? `sin nota: falta por comprobar ${score.unevaluated} de ${score.total} de peso`
      : score.status === 'EXCLUDED'
        ? 'sin nota: excluido del examen'
        : 'sin nota: no se pudo evaluar nada de este alumno'
  return row
}

const STATE_TEXT: Record<StudentResult['status'], string> = {
  OK: 'Evaluado',
  PARTIAL: 'Incompleto',
  NOT_EVALUATED: 'Sin evaluar',
  EXCLUDED: 'Excluido'
}

export function gradeRows(run: RunResult, scale: Scale): GradeRow[] {
  return run.students.map((student) => gradeRow(student, scale))
}

const HEADER = [
  'alumno',
  'identificador',
  'moodle',
  'estado',
  'nota',
  'escala',
  'observaciones',
  'bien',
  'mal',
  'sin_evaluar'
]

/**
 * The grades of a run as a CSV.
 *
 * Only what a grade sheet needs travels: names, identifiers, state, grade and
 * counts. No command, no student output and therefore no secret, which the
 * artifact does not carry either (ADR-0009): a spreadsheet gets forwarded by
 * mail and a captured output has no business in one.
 *
 * Semicolons and a comma for decimals because that is what a spreadsheet in
 * Spanish reads; the BOM is what keeps the accents from arriving broken.
 */
export function toCsv(run: RunResult, scale: Scale): string {
  const lines = [HEADER.join(';')]
  for (const row of gradeRows(run, scale)) {
    lines.push(
      [
        row.name,
        row.studentId,
        row.moodleId,
        row.state,
        row.grade,
        row.grade ? String(scale.max) : '',
        row.note,
        String(row.pass),
        String(row.fail),
        String(row.unevaluated)
      ]
        .map(field)
        .join(';')
    )
  }
  return `﻿${lines.join('\r\n')}\r\n`
}

/**
 * One field, escaped for the format and defused for the spreadsheet: a name
 * read from the classroom that starts like a formula is data, not something
 * for Excel to evaluate when the teacher opens the file (F-14).
 */
function field(value: string): string {
  const defused = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  if (!/[";\r\n]/.test(defused)) return defused
  return `"${defused.replace(/"/g, '""')}"`
}

/** What the file is called by default, so two exports never overwrite each other. */
export function csvName(run: RunResult): string {
  const exam = (run.exam?.path ?? 'examen').split(/[\\/]/).pop() ?? 'examen'
  const stamp = run.started_at.replace(/[-:]/g, '').replace(/[.Z].*$/, '').replace('T', '-')
  return `notas-${exam.replace(/\.[^.]+$/, '')}-${stamp}.csv`
}

/** What the teacher is told the export contains, before saving it. */
export function exportSummary(run: RunResult, scale: Scale): string {
  const rows = gradeRows(run, scale)
  const graded = rows.filter((row) => row.grade !== '').length
  return `${rows.length} alumnos · ${graded} con nota final en escala ${scale.label} · ${rows.length - graded} sin nota · corrección del ${dateText(run.finished_at)}`
}
