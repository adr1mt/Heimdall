import { describe, expect, it } from 'vitest'
import { attentionList, distribution, failRate, failingChecks, finalScore } from '@/lib/analytics'
import { DEFAULT_PASS_MARK, classSummary } from '@/lib/summary'
import type { CheckResult, RunResult, StudentResult } from '../src/shared/artifact'
import type { Score } from '../src/shared/events'

function check(
  id: string,
  status: CheckResult['status'],
  cause: CheckResult['cause'] = 'NONE',
  detail = ''
): CheckResult {
  return {
    check_id: id,
    group: 'Base',
    description: `Comprobación ${id}`,
    weight: 1,
    status,
    cause,
    detail,
    execution: null,
    assertion: null
  } as CheckResult
}

function score(partial: Partial<Score> & Pick<Score, 'status'>): Score {
  return {
    final_score: 0,
    provisional_score: 0,
    obtained: 0,
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

const run = (students: StudentResult[]): RunResult => ({ students }) as RunResult
const complete = (value: number): Score =>
  score({ status: 'COMPLETE', final_score: value, evaluable: 2, total: 2 })
const broken = score({ status: 'INCOMPLETE', provisional_score: 100, evaluable: 1, unevaluated: 1, total: 2 })

/** Una clase con de todo: dos que van bien, una que suspende, una rota. */
const CLASS = run([
  student('ana', 'Ana Ferrer', complete(90), [check('c1', 'PASS'), check('c2', 'PASS')]),
  student('marc', 'Marc Oliva', complete(55), [check('c1', 'PASS'), check('c2', 'FAIL')]),
  student('laia', 'Laia Puig', complete(20), [check('c1', 'FAIL'), check('c2', 'FAIL')]),
  student(
    'noa',
    'Noa Sala',
    broken,
    [check('c1', 'PASS'), check('c2', 'UNEVALUATED', 'CONNECT_FAILED', 'no se pudo conectar')],
    'PARTIAL'
  ),
  student('fora', 'Fora Llista', complete(0), [check('c1', 'FAIL')], 'EXCLUDED')
])

describe('la distribución del grupo', () => {
  it('no cuenta como un cero a quien no tiene nota', () => {
    const { bands, ungraded } = distribution(CLASS)
    expect(ungraded).toBe(1)
    // La máquina caída no ha engordado la banda de abajo.
    expect(bands[0].students).toBe(0)
    expect(bands[1].students).toBe(1) // Laia, con 20
    expect(bands[2].students).toBe(1) // Marc, con 55
    expect(bands[4].students).toBe(1) // Ana, con 90
  })

  it('deja fuera a quien no iba a ser evaluado', () => {
    const { bands, ungraded } = distribution(CLASS)
    const counted = bands.reduce((total, band) => total + band.students, 0) + ungraded
    expect(counted).toBe(4)
  })

  it('mete el 100 en la banda de arriba y no lo pierde', () => {
    const { bands } = distribution(run([student('a', 'A', complete(100), [])]))
    expect(bands[4].students).toBe(1)
  })
})

describe('los números coinciden con los de Resultados', () => {
  it('cuenta los mismos alumnos, las mismas notas y los mismos que atender', () => {
    const summary = classSummary(CLASS, DEFAULT_PASS_MARK)
    const { bands, ungraded } = distribution(CLASS)
    const graded = bands.reduce((total, band) => total + band.students, 0)

    expect(graded).toBe(summary.graded)
    expect(graded + ungraded).toBe(summary.students)
    expect(attentionList(CLASS, DEFAULT_PASS_MARK)).toHaveLength(summary.attention)
  })

  it('la nota que enseña es la que publicó el motor, sin recalcular nada', () => {
    expect(CLASS.students.map(finalScore)).toEqual([90, 55, 20, null, 0])
  })
})

describe('a quién atender primero', () => {
  it('una máquina caída pesa más que cualquier nota baja', () => {
    const list = attentionList(CLASS, DEFAULT_PASS_MARK)
    expect(list[0].student.student_id).toBe('noa')
    expect(list[0].reason).toBe('BROKEN')
    expect(list[1].student.student_id).toBe('laia')
    expect(list[1].reason).toBe('FAILING')
  })

  it('dice qué pasó en la máquina, con las palabras del motor', () => {
    expect(attentionList(CLASS, DEFAULT_PASS_MARK)[0].detail).toBe('no se pudo conectar')
  })

  it('quien aprueba y quien está excluido no salen en la lista', () => {
    const ids = attentionList(CLASS, DEFAULT_PASS_MARK).map((a) => a.student.student_id)
    expect(ids).not.toContain('ana')
    expect(ids).not.toContain('marc')
    expect(ids).not.toContain('fora')
  })

  it('entre dos rotos, primero el que tiene más sin evaluar', () => {
    const list = attentionList(
      run([
        student('poco', 'Poco', broken, [check('c1', 'PASS'), check('c2', 'UNEVALUATED', 'TIMEOUT')], 'PARTIAL'),
        student(
          'mucho',
          'Mucho',
          broken,
          [check('c1', 'UNEVALUATED', 'CONNECT_FAILED'), check('c2', 'UNEVALUATED', 'CONNECT_FAILED')],
          'NOT_EVALUATED'
        )
      ]),
      DEFAULT_PASS_MARK
    )
    expect(list.map((a) => a.student.student_id)).toEqual(['mucho', 'poco'])
  })

  it('entre dos que suspenden, primero el que va peor', () => {
    const list = attentionList(
      run([
        student('a', 'A', complete(45), [check('c1', 'FAIL')]),
        student('b', 'B', complete(10), [check('c1', 'FAIL')])
      ]),
      DEFAULT_PASS_MARK
    )
    expect(list.map((a) => a.student.student_id)).toEqual(['b', 'a'])
  })

  it('un alumno roto sale en la lista aunque su nota provisional apruebe', () => {
    expect(attentionList(CLASS, DEFAULT_PASS_MARK).map((a) => a.student.student_id)).toContain('noa')
  })
})

describe('qué comprobación está fallando al grupo', () => {
  it('ordena por cuántos la fallan', () => {
    const failing = failingChecks(CLASS)
    expect(failing[0].checkId).toBe('c2')
    expect(failing[0].failed).toBe(2)
  })

  it('no cuenta como suspenso lo que no se pudo evaluar', () => {
    const [c2] = failingChecks(CLASS)
    expect(c2.unevaluated).toBe(1)
    // Noa no la falló: no se le pudo preguntar.
    expect(c2.evaluated).toBe(3)
    expect(failRate(c2)).toBe(67)
  })

  it('deja fuera la que nadie ha fallado', () => {
    const buena = run([
      student('a', 'A', complete(100), [check('c1', 'PASS')]),
      student('b', 'B', complete(100), [check('c1', 'PASS')])
    ])
    expect(failingChecks(buena)).toEqual([])
  })

  it('una comprobación que nadie pudo hacer sale, y sin porcentaje', () => {
    const rota = run([
      student('a', 'A', broken, [check('c1', 'UNEVALUATED', 'CONNECT_FAILED')], 'NOT_EVALUATED')
    ])
    const [c1] = failingChecks(rota)
    expect(c1.unevaluated).toBe(1)
    expect(c1.evaluated).toBe(0)
    expect(failRate(c1)).toBeNull()
  })
})
