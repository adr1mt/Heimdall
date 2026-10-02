import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArtifact, type CheckResult, type RunResult, type Stream } from '../src/shared/artifact'
import {
  CAUSE_TEXT,
  REMOTE_TEXT,
  STATUS_TEXT,
  STUDENT_TEXT,
  causesIn,
  checkMatches,
  filterRun,
  originText,
  pendingStudents,
  previousText,
  retryScope,
  scoreView,
  tally,
  truncationNote,
  NO_FILTERS
} from '../src/renderer/src/lib/results'
import { validRun } from './fixtures/valid-run'
import { SCALES } from '../src/renderer/src/lib/scale'
import type { Score } from '../src/shared/events'

/** The engine's own enums, so a cause added there fails here and not in class. */
function enumsOf(type: string): string[] {
  const source = readFileSync(join(__dirname, '../../internal/model/enums.go'), 'utf-8')
  const block = source.slice(source.indexOf(`type ${type} string`))
  const body = block.slice(block.indexOf('const ('), block.indexOf('\n)'))
  return [...body.matchAll(new RegExp(`${type}\\s*=\\s*"([A-Z_]+)"`, 'g'))].map((m) => m[1])
}

describe('las palabras del modelo', () => {
  it('da una frase a cada causa técnica que el motor puede producir', () => {
    expect(enumsOf('Cause').sort()).toEqual(Object.keys(CAUSE_TEXT).sort())
    for (const text of Object.values(CAUSE_TEXT)) expect(text.length).toBeGreaterThan(3)
  })

  it('da una palabra a cada estado académico y a cada estado de alumno', () => {
    expect(enumsOf('AcademicStatus').sort()).toEqual(Object.keys(STATUS_TEXT).sort())
    expect(enumsOf('StudentStatus').sort()).toEqual(Object.keys(STUDENT_TEXT).sort())
  })

  it('sabe qué decir de cada estado del proceso en la máquina del alumno', () => {
    expect(enumsOf('RemoteProcessState').sort()).toEqual(Object.keys(REMOTE_TEXT).sort())
    // Un proceso terminado no deja trabajo pendiente: no hay nada que decir.
    expect(REMOTE_TEXT.FINISHED).toBeNull()
    expect(REMOTE_TEXT.KILLED_REMOTE).toMatch(/proceso suelto/)
  })

  it('no llama suspenso a lo que no se pudo evaluar', () => {
    expect(STATUS_TEXT.UNEVALUATED).toBe('Sin evaluar')
    expect(STUDENT_TEXT.NOT_EVALUATED).toBe('Sin evaluar')
  })
})

function score(partial: Partial<Score>): Score {
  return {
    obtained: 0,
    evaluable: 0,
    total: 6,
    unevaluated: 6,
    provisional_score: null,
    final_score: null,
    status: 'NOT_EVALUATED',
    ...partial
  }
}

describe('scoreView', () => {
  it('publica la nota final solo cuando está todo evaluado', () => {
    const view = scoreView(
      score({ obtained: 6, evaluable: 6, unevaluated: 0, provisional_score: 100, final_score: 100, status: 'COMPLETE' }),
      SCALES.ten
    )
    // El motor publica 100; el profesor lee un 10.
    expect(view).toMatchObject({ value: 100, text: '10,0', kind: 'final' })
  })

  it('un incompleto enseña la provisional, dicha como provisional, y nunca una final', () => {
    const view = scoreView(
      score({ obtained: 4, evaluable: 5, unevaluated: 1, provisional_score: 80, final_score: null, status: 'INCOMPLETE' }),
      SCALES.ten
    )
    expect(view.kind).toBe('provisional')
    expect(view.value).toBe(80)
    expect(view.note).toMatch(/falta 1/)
    // La palabra «provisional» la pone la pantalla una sola vez, junto al número.
    expect(view.note).not.toMatch(/provisional/)
  })

  it('un alumno al que no se pudo llegar no saca un 0: no saca nota', () => {
    const view = scoreView(score({ status: 'NOT_EVALUATED' }), SCALES.ten)
    expect(view.value).toBeNull()
    expect(view.kind).toBe('none')
  })

  it('un alumno excluido tampoco saca nota', () => {
    expect(scoreView(score({ status: 'EXCLUDED' }), SCALES.ten).value).toBeNull()
  })
})

function check(partial: Partial<CheckResult>): CheckResult {
  return {
    check_id: 'p1-hostname',
    group: 'Base',
    description: 'La máquina se llama como toca',
    weight: 1,
    status: 'PASS',
    cause: 'NONE',
    execution: null,
    assertion: null,
    ...partial
  }
}

const RUN: RunResult = {
  schema_version: 1,
  run_id: '01M2Z',
  engine_version: '0.1.0-dev',
  started_at: 't',
  finished_at: 't',
  status: 'PARTIAL',
  exam: { path: 'examen.yaml', sha256: 'x' },
  inventory: { path: 'aula.yaml', sha256: 'y' },
  plan_hash: 'z',
  plan: { check_count: 2, total_weight: 2, check_ids: ['p1-hostname', 'p2-ssh'], concurrency: 16, host_concurrency: 4 },
  students: [
    {
      student_id: 'alumne01',
      name: 'Alumna Uno',
      status: 'PARTIAL',
      started_at: 't',
      finished_at: 't',
      score: score({ status: 'INCOMPLETE' }),
      checks: [check({}), check({ check_id: 'p2-ssh', status: 'UNEVALUATED', cause: 'TIMEOUT' })]
    },
    {
      student_id: 'alumne02',
      name: 'Alumne Dos',
      status: 'NOT_EVALUATED',
      started_at: 't',
      finished_at: 't',
      score: score({}),
      checks: [
        check({ status: 'UNEVALUATED', cause: 'CONNECT_FAILED' }),
        check({ check_id: 'p2-ssh', status: 'UNEVALUATED', cause: 'CONNECT_FAILED' })
      ]
    }
  ]
}

describe('filtros', () => {
  it('sin filtros enseña la clase entera', () => {
    expect(filterRun(RUN, NO_FILTERS)).toHaveLength(2)
  })

  it('filtra por estado y deja fuera al alumno que no tiene ninguno', () => {
    const rows = filterRun(RUN, { ...NO_FILTERS, status: 'PASS' })
    expect(rows).toHaveLength(1)
    expect(rows[0].student.student_id).toBe('alumne01')
  })

  it('filtra por causa técnica', () => {
    const rows = filterRun(RUN, { ...NO_FILTERS, cause: 'CONNECT_FAILED' })
    expect(rows.map((r) => r.student.student_id)).toEqual(['alumne02'])
  })

  it('busca por alumno y por comprobación, sin distinguir mayúsculas', () => {
    expect(filterRun(RUN, { ...NO_FILTERS, text: 'alumna' })).toHaveLength(1)
    expect(filterRun(RUN, { ...NO_FILTERS, text: 'P2-SSH' })).toHaveLength(2)
    expect(filterRun(RUN, { ...NO_FILTERS, text: 'nadie' })).toHaveLength(0)
  })

  it('ofrece solo las causas que de verdad han salido', () => {
    expect(causesIn(RUN)).toEqual(['CONNECT_FAILED', 'TIMEOUT'])
  })

  it('no cuenta NONE como causa técnica', () => {
    expect(checkMatches(RUN.students[0], RUN.students[0].checks[0], { ...NO_FILTERS, cause: 'NONE' })).toBe(true)
  })
})

describe('tally', () => {
  it('cuenta los tres estados por separado', () => {
    expect(tally(RUN.students[0].checks)).toEqual({ pass: 1, fail: 0, unevaluated: 1 })
  })
})

describe('truncationNote', () => {
  const stream = (partial: Partial<Stream>): Stream => ({
    text: '',
    bytes: 0,
    bytes_total: 0,
    truncated: false,
    ...partial
  })

  it('calla cuando no se cortó nada', () => {
    expect(truncationNote(stream({ bytes: 10, bytes_total: 10 }))).toBeNull()
  })

  it('dice lo que se guardó y lo que el comando sacó de verdad', () => {
    const note = truncationNote(stream({ truncated: true, bytes: 65536, bytes_total: 8 << 20 }))
    expect(note).toMatch(/64 kB/)
    expect(note).toMatch(/8\.0 MB/)
  })
})

describe('parseArtifact', () => {
  it('lee un artefacto del esquema que conoce', () => {
    expect(parseArtifact(JSON.stringify(validRun())).run_id).toBe('R1')
  })

  it('se planta ante un esquema que no conoce, en vez de adivinar', () => {
    expect(() => parseArtifact(JSON.stringify({ ...RUN, schema_version: 2 }))).toThrow(/versión 2/)
  })

  it('no acepta un fichero que no es un resultado', () => {
    expect(() => parseArtifact('no es json')).toThrow(/JSON/)
    expect(() => parseArtifact(JSON.stringify({ schema_version: 1 }))).toThrow(/incompleto/)
  })
})

// Un aula donde las comprobaciones no pesan lo mismo: es el caso en que
// contar comprobaciones y contar peso dicen cosas distintas.
const PESOS: RunResult = {
  ...RUN,
  plan: { ...RUN.plan, check_count: 3, total_weight: 10, check_ids: ['a', 'b', 'c'] },
  students: [
    {
      student_id: 'alumne01',
      name: 'Alumna Uno',
      status: 'PARTIAL',
      started_at: 't',
      finished_at: 't',
      score: score({ obtained: 3, evaluable: 3, total: 10, unevaluated: 7, provisional_score: 100, status: 'INCOMPLETE' }),
      checks: [
        check({ check_id: 'a', weight: 2, status: 'PASS' }),
        check({ check_id: 'b', weight: 1, status: 'PASS' }),
        check({ check_id: 'c', weight: 7, status: 'UNEVALUATED', cause: 'CONNECT_FAILED' })
      ]
    },
    {
      student_id: 'alumne02',
      name: 'Alumne Dos',
      status: 'OK',
      started_at: 't',
      finished_at: 't',
      score: score({ obtained: 10, evaluable: 10, total: 10, unevaluated: 0, final_score: 100, status: 'COMPLETE' }),
      checks: [
        check({ check_id: 'a', weight: 2 }),
        check({ check_id: 'b', weight: 1 }),
        check({ check_id: 'c', weight: 7 })
      ]
    },
    {
      student_id: 'alumne03',
      name: 'Alumne Tres',
      status: 'EXCLUDED',
      started_at: 't',
      finished_at: 't',
      score: score({ total: 10, unevaluated: 0, status: 'EXCLUDED' }),
      checks: []
    }
  ]
}

describe('qué ha quedado sin comprobar', () => {
  it('cuenta comprobaciones y peso por separado, porque no son la misma medida', () => {
    const [uno] = pendingStudents(PESOS)
    expect(uno.student.student_id).toBe('alumne01')
    // Una sola comprobación de tres, pero siete décimas del examen.
    expect(uno.checks).toBe(1)
    expect(uno.checkTotal).toBe(3)
    expect(uno.weight).toBe(7)
    expect(uno.weightTotal).toBe(10)
  })

  it('deja fuera a quien no tiene nada sin evaluar y a quien estaba excluido', () => {
    expect(pendingStudents(PESOS).map((p) => p.student.student_id)).toEqual(['alumne01'])
  })

  it('cuenta lo mismo que el motor repetiría, también un diagnóstico sin peso', () => {
    // Un alumno con nota cerrada y una comprobación de peso 0 sin evaluar: el
    // motor la repetiría, así que la pantalla no puede callársela. Que no le
    // falta nota lo dice su propio peso pendiente, que es 0.
    const conDiagnostico: RunResult = {
      ...PESOS,
      students: [
        {
          ...PESOS.students[1],
          checks: [
            check({ check_id: 'a', weight: 2 }),
            check({ check_id: 'b', weight: 1 }),
            check({ check_id: 'c', weight: 7 }),
            check({ check_id: 'd', weight: 0, status: 'UNEVALUATED', cause: 'TIMEOUT' })
          ]
        }
      ]
    }
    const [fila] = pendingStudents(conDiagnostico)
    expect(fila.checks).toBe(1)
    expect(fila.weight).toBe(0)
    expect(fila.student.score.final_score).toBe(100)
    expect(retryScope(conDiagnostico)).toEqual({ students: 1, checks: 1 })
  })

  it('el peso que falta sale del motor, no de sumar nada aquí', () => {
    expect(pendingStudents(PESOS)[0].weight).toBe(PESOS.students[0].score.unevaluated)
  })

  it('un incompleto no tiene nota final en ningún caso', () => {
    for (const pending of pendingStudents(PESOS)) {
      expect(pending.student.score.final_score).toBeNull()
    }
  })
})

describe('qué se ofrece repetir', () => {
  it('cuenta solo lo que quedó sin evaluar, nunca un fallo', () => {
    // alumne01 tiene dos PASS y un UNEVALUATED: se repite uno.
    expect(retryScope(PESOS)).toEqual({ students: 1, checks: 1 })
  })

  it('no ofrece nada cuando no quedó nada sin evaluar', () => {
    const entera: RunResult = { ...PESOS, students: [PESOS.students[1]] }
    expect(retryScope(entera)).toBeNull()
  })

  it('un FAIL no entra en el reintento', () => {
    const conFallo: RunResult = {
      ...PESOS,
      students: [
        {
          ...PESOS.students[0],
          checks: [
            check({ check_id: 'a', weight: 2, status: 'FAIL' }),
            check({ check_id: 'b', weight: 1, status: 'FAIL' }),
            check({ check_id: 'c', weight: 7, status: 'UNEVALUATED', cause: 'TIMEOUT' })
          ]
        }
      ]
    }
    expect(retryScope(conFallo)).toEqual({ students: 1, checks: 1 })
  })
})

describe('de qué ejecución sale cada nota', () => {
  it('una corrección normal se nombra por su fecha', () => {
    const text = originText({ ...PESOS, finished_at: '2026-09-20T10:30:00+02:00' })
    expect(text).toMatch(/^Corrección del /)
    expect(text).not.toMatch(/[Rr]eintento/)
  })

  it('un reintento dice de qué corrección viene y cuánto repitió', () => {
    const text = originText({
      ...PESOS,
      finished_at: '2026-09-20T11:00:00+02:00',
      retry_of: {
        run_id: '01M2Y',
        artifact: 'var/run-01M2Y.json',
        run_at: '2026-09-20T10:30:00+02:00',
        students: 3,
        checks: 5
      }
    })
    expect(text).toMatch(/Reintento/)
    expect(text).toMatch(/5 comprobaciones de 3 alumnos/)
  })

  it('conserva la causa del intento anterior, no solo que lo hubo', () => {
    expect(
      previousText({
        run_id: '01M2Y',
        status: 'UNEVALUATED',
        cause: 'CONNECT_FAILED',
        finished_at: 't'
      })
    ).toMatch(/no se pudo conectar con la máquina/i)
  })

  it('dice también lo que ya tenía resultado', () => {
    expect(
      previousText({ run_id: '01M2Y', status: 'FAIL', cause: 'NONE', finished_at: 't' })
    ).toMatch(/salió mal/)
  })
})
