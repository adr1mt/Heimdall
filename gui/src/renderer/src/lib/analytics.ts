import type { CheckResult, RunResult, StudentResult } from '../../../shared/artifact'

/**
 * Analíticas: the three things the teacher actually looks at after a
 * correction (T125) — the objectives the group fails most, how the grades
 * fall, and how each part of the exam went.
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

/** How many failing objectives are worth looking at. Past the fourth nobody reads. */
export const MOST_FAILED = 4

export interface GroupRate {
  /** The group of checks, as the exam names it. */
  group: string
  /** Checks of the group that were actually evaluated, over every student. */
  evaluated: number
  /** Of those, the ones the student got right. */
  passed: number
  /** Share passed, 0-100, or null when nothing of the group was evaluated. */
  rate: number | null
  /** Checks of the group nobody could be evaluated on. */
  unevaluated: number
}

/**
 * How each part of the exam went, worst first.
 *
 * The share is over what was actually evaluated: a group nobody could be
 * evaluated on is not a group everybody failed, and counting it as such would
 * turn a broken lab into a teaching problem (principio 3).
 */
export function successByGroup(run: RunResult): GroupRate[] {
  const byGroup = new Map<string, GroupRate>()
  for (const student of run.students.filter(counts)) {
    for (const check of student.checks) {
      const entry = byGroup.get(check.group) ?? {
        group: check.group,
        evaluated: 0,
        passed: 0,
        rate: null,
        unevaluated: 0
      }
      if (check.status === 'UNEVALUATED') entry.unevaluated += 1
      else {
        entry.evaluated += 1
        if (check.status === 'PASS') entry.passed += 1
      }
      byGroup.set(check.group, entry)
    }
  }
  return [...byGroup.values()]
    .map((entry) => ({
      ...entry,
      rate: entry.evaluated === 0 ? null : Math.round((entry.passed / entry.evaluated) * 100)
    }))
    .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.group.localeCompare(b.group, 'es'))
}
