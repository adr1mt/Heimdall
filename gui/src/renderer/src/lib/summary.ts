import type { RunResult, StudentResult } from '../../../shared/artifact'
import { DEFAULT_PASS_MARK, toScale, type Scale } from './scale'

/**
 * How the class is doing, in the three numbers the teacher reads first.
 *
 * Nothing here is a grade: every number is counted over the grades the engine
 * already published (principio 12). Two rules decide what is countable:
 *
 * - a student with no final grade is not a fail. They are not in `passed`,
 *   not in `average` and never as a zero, because a technical problem is not
 *   an academic result (principio 3);
 * - an excluded student is not part of the class for any of this: nobody was
 *   going to evaluate them.
 */
export interface ClassSummary {
  /** Students the exam applies to: everybody but the excluded. */
  students: number
  /** Of those, the ones with a closed grade. */
  graded: number
  /** Of the graded ones, how many reach the pass mark. */
  passed: number
  /** Mean of the closed grades, 0-100, or null when there is none. */
  average: number | null
  /** Students to look at first: an unevaluated check, or a grade below the mark. */
  attention: number
}

/**
 * The pass mark lives with the scale it anchors: it is the same number that
 * puts the 5 in the middle of «0 a 10», and two copies of it would eventually
 * disagree.
 */
export { DEFAULT_PASS_MARK }

function counts(student: StudentResult): boolean {
  return student.status !== 'EXCLUDED'
}

/** Whether this student is one to walk over to. */
export function needsAttention(student: StudentResult, passMark: number): boolean {
  if (!counts(student)) return false
  // A machine nobody could reach comes first: from the outside it looks the
  // same as a student who did nothing, and it needs the opposite reaction.
  if (student.checks.some((check) => check.status === 'UNEVALUATED')) return true
  const final = finalScore(student)
  return final !== null && final < passMark
}

/**
 * The closed grade of a student, or null when there is none.
 *
 * The state and the number are checked together on purpose: the type allows a
 * COMPLETE with no number, and treating that as a zero is exactly the mistake
 * this whole screen exists to avoid.
 */
function finalScore(student: StudentResult): number | null {
  if (student.score.status !== 'COMPLETE') return null
  return student.score.final_score ?? null
}

export function classSummary(run: RunResult, passMark: number): ClassSummary {
  const students = run.students.filter(counts)
  const finals = students
    .map(finalScore)
    .filter((score): score is number => score !== null)

  return {
    students: students.length,
    graded: finals.length,
    passed: finals.filter((score) => score >= passMark).length,
    average: finals.length === 0 ? null : round1(finals.reduce((a, b) => a + b, 0) / finals.length),
    attention: students.filter((student) => needsAttention(student, passMark)).length
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Mean of the displayed final grades. The scale is nonlinear: convert first. */
export function displayedAverage(run: RunResult, scale: Scale): number | null {
  const grades = run.students.filter(counts).map(finalScore)
    .filter((value): value is number => value !== null)
    .map((value) => Number(toScale(value, scale).replace(',', '.')))
  return grades.length ? grades.reduce((sum, value) => sum + value, 0) / grades.length : null
}

export function averageText(average: number | null): string {
  if (average === null) return '—'
  // Grades are bounded by 100. Remove binary noise before rounding to cents.
  const rounded = Math.round((average + Number.EPSILON * 100) * 100) / 100
  return rounded.toFixed(2).replace('.', ',')
}

/**
 * A first name, with initials when it is shared by classmates. Names are
 * stored as one string, so only whitespace boundaries are used here.
 */
export function shortName(name: string, taken: string[] = []): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0] ?? name
  if (parts.length === 1 || !taken.some((value) => nameKey(value) === nameKey(first))) return first
  return `${first} ${parts.slice(1).map((part) => `${[...part][0].toUpperCase()}.`).join(' ')}`
}

function nameKey(name: string): string {
  return name.normalize('NFKC').toLowerCase()
}

/** Compute over the entire class, never the currently filtered/visible rows. */
export function studentShortNames(students: Pick<StudentResult, 'student_id' | 'name'>[]): Map<string, string> {
  const names = students.map((student) => student.name.trim().replace(/\s+/g, ' '))
  const firsts = names.map((name) => name.split(' ')[0])
  const counts = (values: string[]): Map<string, number> => {
    const result = new Map<string, number>()
    for (const value of values) result.set(nameKey(value), (result.get(nameKey(value)) ?? 0) + 1)
    return result
  }
  const firstCounts = counts(firsts)
  const repeated = [...firstCounts].filter(([, count]) => count > 1).map(([first]) => first)
  const labels = names.map((name, i) => shortName(name, repeated) || students[i].student_id)
  const labelCounts = counts(labels)
  const fullCounts = counts(names)
  return new Map(students.map((student, i) => {
    let label = labels[i]
    if (labelCounts.get(nameKey(label))! > 1) {
      label = names[i] || student.student_id
      if (fullCounts.get(nameKey(names[i]))! > 1) label += ` (${student.student_id})`
    }
    return [student.student_id, label]
  }))
}
