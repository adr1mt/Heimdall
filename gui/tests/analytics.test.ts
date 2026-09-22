import { describe, expect, it } from 'vitest'
import {
  MOST_FAILED,
  distribution,
  failRate,
  failingChecks,
  finalScore,
  successByGroup
} from '@/lib/analytics'
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
  // 75 está por encima de la marca de aprobado: Marc es el que va justo pero pasa.
  student('marc', 'Marc Oliva', complete(75), [check('c1', 'PASS'), check('c2', 'FAIL')]),
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
    expect(bands[3].students).toBe(1) // Marc, con 75
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
  it('cuenta los mismos alumnos y las mismas notas', () => {
    const summary = classSummary(CLASS, DEFAULT_PASS_MARK)
    const { bands, ungraded } = distribution(CLASS)
    const graded = bands.reduce((total, band) => total + band.students, 0)

    expect(graded).toBe(summary.graded)
    expect(graded + ungraded).toBe(summary.students)
  })

  it('la nota que enseña es la que publicó el motor, sin recalcular nada', () => {
    expect(CLASS.students.map(finalScore)).toEqual([90, 75, 20, null, 0])
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

/** La misma comprobación, pero en el grupo del examen que se diga. */
function inGroup(group: string, c: CheckResult): CheckResult {
  return { ...c, group }
}

// Analíticas se quedó con tres cosas (T125). Dos son la distribución y los
// objetivos más fallados, que ya estaban; la tercera es cómo ha ido cada
// parte del examen.
describe('la tasa de éxito por grupo', () => {
  const GROUPED = run([
    student('ana', 'Ana Ferrer', complete(50), [
      inGroup('Red', check('r1', 'PASS')),
      inGroup('DHCP', check('d1', 'FAIL'))
    ]),
    student('marc', 'Marc Oliva', complete(50), [
      inGroup('Red', check('r1', 'PASS')),
      inGroup('DHCP', check('d1', 'FAIL'))
    ]),
    student('laia', 'Laia Puig', complete(50), [
      inGroup('Red', check('r1', 'FAIL')),
      inGroup('DHCP', check('d1', 'PASS'))
    ])
  ])

  it('cuenta cada grupo sobre lo que de verdad se comprobó, el peor primero', () => {
    expect(successByGroup(GROUPED)).toEqual([
      { group: 'DHCP', evaluated: 3, passed: 1, rate: 33, unevaluated: 0 },
      { group: 'Red', evaluated: 3, passed: 2, rate: 67, unevaluated: 0 }
    ])
  })

  it('un grupo que no se pudo comprobar no es un grupo que todos suspenden', () => {
    const rate = successByGroup(
      run([
        student('noa', 'Noa Sala', broken, [
          inGroup('Red', check('r1', 'UNEVALUATED', 'CONNECT_FAILED', 'no se pudo conectar'))
        ])
      ])
    )
    expect(rate).toEqual([{ group: 'Red', evaluated: 0, passed: 0, rate: null, unevaluated: 1 }])
  })

  it('no cuenta al alumno excluido, que no iba a evaluarse', () => {
    const rate = successByGroup(
      run([
        student('ana', 'Ana Ferrer', complete(100), [inGroup('Red', check('r1', 'PASS'))]),
        student('fuera', 'Fuera', complete(0), [inGroup('Red', check('r1', 'FAIL'))], 'EXCLUDED')
      ])
    )
    expect(rate).toEqual([{ group: 'Red', evaluated: 1, passed: 1, rate: 100, unevaluated: 0 }])
  })
})

// Tres o cuatro objetivos y no más: una lista de veinte no se mira.
describe('los objetivos más fallados', () => {
  it('no enseña más de cuatro', () => {
    expect(MOST_FAILED).toBe(4)
    const many = run([
      student(
        'ana',
        'Ana Ferrer',
        complete(0),
        ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id) => check(id, 'FAIL'))
      )
    ])
    expect(failingChecks(many).length).toBeGreaterThan(MOST_FAILED)
    expect(failingChecks(many).slice(0, MOST_FAILED)).toHaveLength(4)
  })
})
