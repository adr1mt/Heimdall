import type { CheckResult, StudentResult } from '../../../shared/artifact'

/**
 * The matrix: one row per check, one column per student.
 *
 * It answers in one look the three questions a list cannot: which student is
 * going badly (a poor column), which check is failing everybody (a red row,
 * which means the wording is the problem and not the class) and who has a
 * technical incident (an amber column).
 *
 * The rows come from the PLAN, in its order and the same for everybody
 * (principio 7): a check nobody could run still gets its row, and a student
 * who is missing it gets an empty cell instead of disappearing.
 */
export interface MatrixRow {
  checkId: string
  description: string
  group: string
  weight: number
  /** One cell per student, in the same order as `students`. Null: no result. */
  cells: (CheckResult | null)[]
}

export interface Matrix {
  students: StudentResult[]
  rows: MatrixRow[]
}

export function buildMatrix(
  rows: { student: StudentResult; checks: CheckResult[] }[]
): Matrix {
  const students = rows.map((row) => row.student)
  const order: string[] = []
  const meta = new Map<string, CheckResult>()

  for (const row of rows) {
    for (const check of row.checks) {
      if (!meta.has(check.check_id)) {
        meta.set(check.check_id, check)
        order.push(check.check_id)
      }
    }
  }

  const byStudent = rows.map((row) => new Map(row.checks.map((c) => [c.check_id, c])))

  return {
    students,
    rows: order.map((checkId) => {
      const first = meta.get(checkId) as CheckResult
      return {
        checkId,
        description: first.description,
        group: first.group,
        weight: first.weight,
        cells: byStudent.map((checks) => checks.get(checkId) ?? null)
      }
    })
  }
}
