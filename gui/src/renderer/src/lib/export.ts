import type { RunResult, StudentResult } from '../../../shared/artifact'
import type { AcademicStatus, Score, StudentStatus } from '../../../shared/events'
import type { Consolidation } from '../../../shared/consolidation'
import type { Session } from '../../../shared/session'
import { dateText } from './results'
import { SESSION_STATUS_TEXT } from './session'

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
 * What the export needs of a student: who they are, what state they are in and
 * the grade the engine published. One correction and a whole chain say it in
 * the same words, so both export with the same rules and neither of them can
 * invent a grade the other would not (ADR-0019, T056).
 */
export interface Gradable {
  student_id: string
  name: string
  moodle_id?: string
  status: StudentStatus
  score: Score
  checks: { status: AcademicStatus }[]
}

/**
 * What one student exports.
 *
 * A student without a final grade exports an empty grade and the reason, never
 * a number: a provisional grade in a spreadsheet is indistinguishable from a
 * closed one, and a 0 for a machine nobody could reach would be a fail the
 * student did not earn (principio 3, ADR-0006).
 */
export function gradeRow(student: Gradable, scale: Scale): GradeRow {
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

  const { grade, note } = gradeOf(student.score, scale)
  row.grade = grade
  row.note = note
  return row
}

/**
 * The grade of one student, or the reason there is none. A single correction,
 * a chain and an exam session all write it with these same words, so none of
 * them can put a number where the others would put a reason.
 */
export function gradeOf(score: Score, scale: Scale): { grade: string; note: string } {
  if (score.status === 'COMPLETE' && score.final_score !== null) {
    return { grade: toScale(score.final_score, scale), note: '' }
  }
  return {
    grade: '',
    note:
      score.status === 'INCOMPLETE'
        ? `sin nota: falta por comprobar ${score.unevaluated} de ${score.total} de peso`
        : score.status === 'EXCLUDED'
          ? 'sin nota: excluido del examen'
          : 'sin nota: no se pudo evaluar nada de este alumno'
  }
}

const STATE_TEXT: Record<StudentStatus, string> = {
  OK: 'Evaluado',
  PARTIAL: 'Incompleto',
  NOT_EVALUATED: 'Sin evaluar',
  EXCLUDED: 'Excluido'
}

export function gradeRows(run: RunResult, scale: Scale): GradeRow[] {
  return run.students.map((student) => gradeRow(student, scale))
}

/** The same, for a chain the engine read as one. */
export function chainGradeRows(chain: Consolidation, scale: Scale): GradeRow[] {
  return chain.students.map((student) => gradeRow(student, scale))
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
  return csvOf(gradeRows(run, scale), scale)
}

/**
 * The grades of a whole chain, written exactly like those of a single
 * correction: a student still missing a weighted check travels without a
 * number, however many corrections were read to get there.
 */
export function chainCsv(chain: Consolidation, scale: Scale): string {
  return csvOf(chainGradeRows(chain, scale), scale)
}

function csvOf(rows: GradeRow[], scale: Scale): string {
  const lines = [HEADER.join(';')]
  for (const row of rows) {
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

/** The chain's file name, said so it cannot be taken for one correction's. */
export function chainCsvName(chain: Consolidation): string {
  return `notas-consolidado-${stamp(chain.runs[0]?.finished_at ?? '')}.csv`
}

/** What the teacher is told a chain's export contains, before saving it. */
export function chainExportSummary(chain: Consolidation, scale: Scale): string {
  const rows = chainGradeRows(chain, scale)
  const graded = rows.filter((row) => row.grade !== '').length
  return `${rows.length} alumnos · ${graded} con nota final en escala ${scale.label} · ${rows.length - graded} sin nota · ${chain.runs.length} correcciones leídas juntas`
}

/** One line of a session's export: the same, plus which round the grade is from. */
export interface SessionGradeRow {
  name: string
  studentId: string
  moodleId: string
  state: string
  grade: string
  note: string
  /** The round the grade comes from, or '' when there is none. */
  round: string
}

/**
 * What a session exports, student by student.
 *
 * The grade is the engine's, of the round the engine picked, and a student
 * without a single whole round exports no number at all: the reason travels
 * instead, in the engine's own words when it wrote one (ADR-0020).
 */
export function sessionGradeRows(session: Session, scale: Scale): SessionGradeRow[] {
  return session.students.map((student) => {
    const { grade, note } = gradeOf(student.score, scale)
    return {
      name: student.name,
      studentId: student.student_id,
      moodleId: student.moodle_id ?? '',
      state: SESSION_STATUS_TEXT[student.status],
      grade,
      note: grade ? '' : (student.reason ?? note),
      round: student.from_round > 0 ? String(student.from_round) : ''
    }
  })
}

const SESSION_HEADER = [
  'alumno',
  'identificador',
  'moodle',
  'estado',
  'nota',
  'escala',
  'vuelta',
  'observaciones'
]

/**
 * The grades of an exam session as a CSV. It carries no check counts: a
 * session says which round counts, and the checks of that round live in its
 * own correction, where they can be read with their evidence.
 */
export function sessionCsv(session: Session, scale: Scale): string {
  const lines = [SESSION_HEADER.join(';')]
  for (const row of sessionGradeRows(session, scale)) {
    lines.push(
      [
        row.name,
        row.studentId,
        row.moodleId,
        row.state,
        row.grade,
        row.grade ? String(scale.max) : '',
        row.round,
        row.note
      ]
        .map(field)
        .join(';')
    )
  }
  return `\ufeff${lines.join('\r\n')}\r\n`
}

/** The session's file name, said so it cannot be taken for one round's. */
export function sessionCsvName(session: Session): string {
  return `notas-sesion-${stamp(session.rounds[session.rounds.length - 1]?.finished_at ?? '')}.csv`
}

/** What the teacher is told a session's export contains, before saving it. */
export function sessionExportSummary(session: Session, scale: Scale): string {
  const rows = sessionGradeRows(session, scale)
  const graded = rows.filter((row) => row.grade !== '').length
  return `${rows.length} alumnos · ${graded} con nota final en escala ${scale.label} · ${rows.length - graded} sin nota · ${session.rounds.length} vueltas del examen`
}

/** What the file is called by default, so two exports never overwrite each other. */
export function csvName(run: RunResult): string {
  const exam = (run.exam?.path ?? 'examen').split(/[\\/]/).pop() ?? 'examen'
  return `notas-${exam.replace(/\.[^.]+$/, '')}-${stamp(run.started_at)}.csv`
}

/** A timestamp as it goes in a file name. */
function stamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/[.Z].*$/, '').replace('T', '-')
}

/** What the teacher is told the export contains, before saving it. */
export function exportSummary(run: RunResult, scale: Scale): string {
  const rows = gradeRows(run, scale)
  const graded = rows.filter((row) => row.grade !== '').length
  return `${rows.length} alumnos · ${graded} con nota final en escala ${scale.label} · ${rows.length - graded} sin nota · corrección del ${dateText(run.finished_at)}`
}

/**
 * The grades as Moodle imports them.
 *
 * It is a second, narrower file and not a flag on the first one, because the
 * two have opposite readers. The grade sheet is for the teacher and carries
 * everything that explains a grade; this one is for a machine that matches
 * students by e-mail and reads one number, and every extra column there is one
 * more thing to map by hand at import time.
 *
 * Nothing is converted, decided or filled in here beyond what `gradeOf`
 * already published: the number in this file is the number on screen.
 */

/** One line of the Moodle file: who, and the grade or nothing. */
export interface MoodleRow {
  name: string
  email: string
  /** The final grade in the teacher's scale, or '' when there is none. */
  grade: string
}

/** What a Moodle export needs of a student, as every export already says it. */
interface MoodleSource {
  name: string
  moodleId: string
  grade: string
}

/**
 * The students that can travel to Moodle, which are the ones with an e-mail:
 * that is what Moodle matches on, and a line it cannot match is a line that
 * makes the whole import fail.
 *
 * Leaving them out is not silent. `moodleSummary` says how many stayed behind
 * and why, before the file is written.
 */
export function moodleRows(rows: MoodleSource[]): MoodleRow[] {
  return rows
    .filter((row) => row.moodleId.trim() !== '')
    .map((row) => ({ name: row.name, email: row.moodleId.trim(), grade: row.grade }))
}

const MOODLE_HEADER = ['alumno', 'correo', 'nota']

/**
 * The Moodle file.
 *
 * Semicolons and a comma for decimals: that is what a Moodle in Spanish reads,
 * and the separator is one of the ones its import form offers, so the file
 * goes in as it is written.
 *
 * No BOM, unlike the grade sheet: this file is not opened in a spreadsheet,
 * and the mark would land inside the name of the first column.
 *
 * A student with no final grade keeps their line with the grade cell empty.
 * Moodle leaves an empty cell alone; a 0 would be a fail for a machine nobody
 * could reach (principio 3, ADR-0006).
 */
export function moodleCsv(rows: MoodleRow[]): string {
  const lines = [MOODLE_HEADER.join(';')]
  for (const row of rows) {
    lines.push([row.name, row.email, row.grade].map(field).join(';'))
  }
  return `${lines.join('\r\n')}\r\n`
}

/** What the teacher is told the Moodle file contains, before saving it. */
export function moodleSummary(source: MoodleSource[], scale: Scale): string {
  const rows = moodleRows(source)
  const graded = rows.filter((row) => row.grade !== '').length
  const left = source.length - rows.length
  const parts = [
    `${rows.length} alumnos en el fichero`,
    `${graded} con nota en escala ${scale.label}`,
    `${rows.length - graded} sin nota, con la celda vacía`
  ]
  if (left > 0) parts.push(`${left} fuera del fichero por no tener correo`)
  return parts.join(' · ')
}

/** The Moodle file's name, said so it cannot be taken for the grade sheet. */
export function moodleCsvName(iso: string): string {
  return `moodle-${stamp(iso)}.csv`
}
