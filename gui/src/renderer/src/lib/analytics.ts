import type { CheckResult, RunResult, StudentResult } from '../../../shared/artifact'

/**
 * Analíticas: who to walk over to first, and what the whole group is failing
 * (T110).
 *
 * Nothing here computes a grade. Every number is counted over the grades the
 * engine already published (principio 12), with the same two rules the class
 * summary uses: an excluded student is not part of the class, and a student
 * with no closed grade is NOT a zero — a technical problem is not an academic
 * result (principio 3).
 */

/** The bands the group's grades are shown in, over the engine's 0-100. */
export const BANDS = [
  { from: 0, to: 20 },
  { from: 20, to: 40 },
  { from: 40, to: 60 },
  { from: 60, to: 80 },
  { from: 80, to: 101 }
] as const

export interface Band {
  from: number
  to: number
  students: number
}

/** Why a student is on the list, worst first. */
export type Reason = 'BROKEN' | 'FAILING'

export interface Attention {
  student: StudentResult
  reason: Reason
  /** Checks left unevaluated. Zero for a student who is simply failing. */
  unevaluated: number
  /** The closed grade, or null when there is none. */
  score: number | null
  /** What went wrong on the machine, in the engine's words. */
  detail: string | null
}

export interface FailingCheck {
  checkId: string
  group: string
  description: string
  /** Students who got it wrong, having actually been evaluated on it. */
  failed: number
  /** Students it could not be evaluated on: a broken machine, a timeout. */
  unevaluated: number
  /** Students the check was evaluated on at all. */
  evaluated: number
}

function counts(student: StudentResult): boolean {
  return student.status !== 'EXCLUDED'
}

/**
 * The closed grade, or null. The state and the number are read together: the
 * artifact allows a COMPLETE with no number, and treating that as a zero is
 * the mistake this whole screen exists to avoid.
 */
export function finalScore(student: StudentResult): number | null {
  if (student.score.status !== 'COMPLETE') return null
  return student.score.final_score ?? null
}

/**
 * How the group's grades fall.
 *
 * Only closed grades are in it. A student whose machine was off has no grade,
 * so they are not in the lowest band making the class look worse than it did:
 * they are counted apart, as «sin nota».
 */
export function distribution(run: RunResult): { bands: Band[]; ungraded: number } {
  const students = run.students.filter(counts)
  const bands: Band[] = BANDS.map((band) => ({ ...band, students: 0 }))
  let ungraded = 0
  for (const student of students) {
    const score = finalScore(student)
    if (score === null) {
      ungraded += 1
      continue
    }
    const band = bands.find((b) => score >= b.from && score < b.to)
    if (band) band.students += 1
  }
  return { bands, ungraded }
}

/**
 * Who to walk over to, worst first.
 *
 * A machine nobody could reach comes before any low grade, however low: from
 * the teacher's desk the two look the same and they need opposite reactions,
 * and only one of them is fixed by walking over there (principio 3).
 */
export function attentionList(run: RunResult, passMark: number): Attention[] {
  const list: Attention[] = []
  for (const student of run.students.filter(counts)) {
    const broken = student.checks.filter((check) => check.status === 'UNEVALUATED')
    const score = finalScore(student)
    if (broken.length > 0) {
      list.push({
        student,
        reason: 'BROKEN',
        unevaluated: broken.length,
        score,
        detail: broken.find((check) => check.detail)?.detail ?? null
      })
      continue
    }
    if (score !== null && score < passMark) {
      list.push({ student, reason: 'FAILING', unevaluated: 0, score, detail: null })
    }
  }
  return list.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === 'BROKEN' ? -1 : 1
    if (a.reason === 'BROKEN') return b.unevaluated - a.unevaluated
    return (a.score ?? 0) - (b.score ?? 0)
  })
}

/**
 * The checks the group is getting wrong, worst first.
 *
 * A check nobody could be evaluated on is not a check everybody failed: the
 * two are counted apart, because the first is a broken lab and the second is
 * something that was not taught well enough.
 */
export function failingChecks(run: RunResult): FailingCheck[] {
  const byId = new Map<string, FailingCheck>()
  for (const student of run.students.filter(counts)) {
    for (const check of student.checks) {
      const entry = byId.get(check.check_id) ?? blank(check)
      if (check.status === 'UNEVALUATED') entry.unevaluated += 1
      else {
        entry.evaluated += 1
        if (check.status === 'FAIL') entry.failed += 1
      }
      byId.set(check.check_id, entry)
    }
  }
  return [...byId.values()]
    .filter((check) => check.failed > 0 || check.unevaluated > 0)
    .sort((a, b) => b.failed - a.failed || b.unevaluated - a.unevaluated)
}

function blank(check: CheckResult): FailingCheck {
  return {
    checkId: check.check_id,
    group: check.group,
    description: check.description,
    failed: 0,
    unevaluated: 0,
    evaluated: 0
  }
}

/** «12 de 18», the share of the class a check went wrong for. */
export function failRate(check: FailingCheck): number | null {
  if (check.evaluated === 0) return null
  return Math.round((check.failed / check.evaluated) * 100)
}
