import { describe, expect, it } from 'vitest'
import { t } from '@/i18n/es'
import { DEFAULT_PASS_MARK, classSummary, needsAttention, shortName } from '@/lib/summary'
import { buildMatrix } from '@/lib/matrix'
import type { CheckResult, RunResult, StudentResult } from '../src/shared/artifact'
import type { Score } from '../src/shared/events'

function check(id: string, status: CheckResult['status'], cause: CheckResult['cause'] = 'NONE'): CheckResult {
  return {
    check_id: id,
    group: 'Base',
    description: `Comprobación ${id}`,
    weight: 1,
    status,
    cause,
    detail: '',
    execution: null,
    assertion: null
  } as CheckResult
}

function score(partial: Partial<Score> & Pick<Score, 'status'>): Score {
  return {
    final_score: 0,
    provisional_score: 0,
    earned: 0,
    evaluable: 0,
    unevaluated: 0,
    total: 2,
    ...partial
  } as Score
}

function student(
  id: string,
  name: string,
  s: Score,
  checks: CheckResult[],
  status: StudentResult['status'] = 'OK'
): StudentResult {
  return { student_id: id, name, status, score: s, checks } as StudentResult
}

function run(students: StudentResult[]): RunResult {
  return { students } as RunResult
}

const complete = (value: number): Score =>
  score({ status: 'COMPLETE', final_score: value, evaluable: 2, total: 2 })
const incomplete = score({ status: 'INCOMPLETE', provisional_score: 100, evaluable: 1, unevaluated: 1, total: 2 })

describe('resumen de la clase', () => {
  it('cuenta aprobados y media solo sobre las notas cerradas', () => {
    const summary = classSummary(
      run([
        student('a', 'Ana Ferrer', complete(80), [check('c1', 'PASS'), check('c2', 'PASS')]),
        student('b', 'Marc Oliva', complete(20), [check('c1', 'FAIL'), check('c2', 'FAIL')]),
        student('c', 'Laia Puig', incomplete, [check('c1', 'PASS'), check('c2', 'UNEVALUATED', 'CONNECT_FAILED')], 'PARTIAL')
      ]),
      DEFAULT_PASS_MARK
    )
    expect(summary.students).toBe(3)
    expect(summary.graded).toBe(2)
    expect(summary.passed).toBe(1)
    expect(summary.average).toBe(50)
  })

  it('no convierte en suspenso a quien no tiene nota final', () => {
    const summary = classSummary(
      run([student('c', 'Laia Puig', incomplete, [check('c1', 'UNEVALUATED', 'CONNECT_FAILED')], 'PARTIAL')]),
      DEFAULT_PASS_MARK
    )
    expect(summary.graded).toBe(0)
    expect(summary.passed).toBe(0)
    expect(summary.average).toBeNull()
  })

  it('deja fuera al alumno excluido', () => {
    const excluded = student('x', 'Iris Bonet', score({ status: 'EXCLUDED' }), [], 'EXCLUDED')
    const summary = classSummary(run([excluded]), DEFAULT_PASS_MARK)
    expect(summary.students).toBe(0)
    expect(summary.attention).toBe(0)
  })

  it('pone en atención tanto la avería técnica como la nota baja', () => {
    const broken = student('c', 'Laia Puig', incomplete, [check('c1', 'UNEVALUATED', 'CONNECT_FAILED')], 'PARTIAL')
    const low = student('b', 'Marc Oliva', complete(20), [check('c1', 'FAIL')])
    const fine = student('a', 'Ana Ferrer', complete(80), [check('c1', 'PASS')])
    expect(needsAttention(broken, DEFAULT_PASS_MARK)).toBe(true)
    expect(needsAttention(low, DEFAULT_PASS_MARK)).toBe(true)
    expect(needsAttention(fine, DEFAULT_PASS_MARK)).toBe(false)
    expect(classSummary(run([broken, low, fine]), DEFAULT_PASS_MARK).attention).toBe(2)
  })

  it('respeta la marca de aprobado del profesor', () => {
    const rows = run([student('a', 'Ana Ferrer', complete(60), [check('c1', 'PASS')])])
    expect(classSummary(rows, 50).passed).toBe(1)
    expect(classSummary(rows, 70).passed).toBe(0)
  })

  it('acorta el nombre sin confundir a dos alumnos', () => {
    expect(shortName('Ana Ferrer')).toBe('Ana')
    expect(shortName('Ana Bonet', ['Ana'])).toBe('Ana B.')
  })
})

describe('matriz', () => {
  const rows = [
    { student: student('a', 'Ana', complete(100), [check('c1', 'PASS'), check('c2', 'PASS')]), checks: [check('c1', 'PASS'), check('c2', 'PASS')] },
    { student: student('b', 'Marc', complete(50), [check('c1', 'PASS'), check('c2', 'FAIL')]), checks: [check('c1', 'PASS'), check('c2', 'FAIL')] }
  ]

  it('coloca una fila por comprobación y una columna por alumno', () => {
    const matrix = buildMatrix(rows)
    expect(matrix.rows.map((r) => r.checkId)).toEqual(['c1', 'c2'])
    expect(matrix.students.map((s) => s.name)).toEqual(['Ana', 'Marc'])
    expect(matrix.rows[1].cells.map((c) => c?.status)).toEqual(['PASS', 'FAIL'])
  })

  it('deja la celda vacía y no borra al alumno cuando le falta una comprobación', () => {
    const matrix = buildMatrix([rows[0], { student: rows[1].student, checks: [check('c1', 'PASS')] }])
    expect(matrix.students).toHaveLength(2)
    expect(matrix.rows[1].cells[1]).toBeNull()
  })

  it('conserva el orden del PLAN aunque el primer alumno no traiga todas', () => {
    const matrix = buildMatrix([
      { student: rows[0].student, checks: [check('c1', 'PASS')] },
      { student: rows[1].student, checks: [check('c1', 'PASS'), check('c2', 'FAIL')] }
    ])
    expect(matrix.rows.map((r) => r.checkId)).toEqual(['c1', 'c2'])
  })
})

// Los tres números de cabecera y las tres palabras del resumen: ninguna
// etiqueta se queda sin su frase (T124).
describe('la cabecera se lee sin preguntar', () => {
  it('dice sobre cuántos alumnos se cuentan los aprobados', () => {
    expect(t.results.kpiPassedHint(18, 18)).toBe('De los 18 alumnos de la clase')
  })

  it('dice cuántos se quedaron sin nota en vez de callarlo', () => {
    expect(t.results.kpiPassedHint(16, 18)).toBe(
      'De los 16 que tienen nota; 2 se quedaron sin ella'
    )
  })

  it('explica «bien», «mal» y «sin evaluar» con una frase cada una', () => {
    for (const phrase of [
      t.results.statePass,
      t.results.stateFail,
      t.results.stateUnevaluated
    ]) {
      expect(phrase.length).toBeGreaterThan(t.results.filterAll.length)
      expect(phrase.endsWith('.')).toBe(true)
    }
  })

  it('deja claro que «sin evaluar» no es un fallo del alumno', () => {
    expect(t.results.stateUnevaluated).toContain('No es un fallo del alumno')
  })
})
