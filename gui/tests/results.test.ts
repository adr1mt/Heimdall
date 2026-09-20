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
  scoreView,
  tally,
  truncationNote,
  NO_FILTERS
} from '../src/renderer/src/lib/results'
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
      score({ obtained: 6, evaluable: 6, unevaluated: 0, provisional_score: 100, final_score: 100, status: 'COMPLETE' })
    )
    expect(view).toMatchObject({ value: 100, kind: 'final' })
  })

  it('un incompleto enseña la provisional, dicha como provisional, y nunca una final', () => {
    const view = scoreView(
      score({ obtained: 4, evaluable: 5, unevaluated: 1, provisional_score: 80, final_score: null, status: 'INCOMPLETE' })
    )
    expect(view.kind).toBe('provisional')
    expect(view.value).toBe(80)
    expect(view.note).toMatch(/falta 1/)
    // La palabra «provisional» la pone la pantalla una sola vez, junto al número.
    expect(view.note).not.toMatch(/provisional/)
  })

  it('un alumno al que no se pudo llegar no saca un 0: no saca nota', () => {
    const view = scoreView(score({ status: 'NOT_EVALUATED' }))
    expect(view.value).toBeNull()
    expect(view.kind).toBe('none')
  })

  it('un alumno excluido tampoco saca nota', () => {
    expect(scoreView(score({ status: 'EXCLUDED' })).value).toBeNull()
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
    expect(parseArtifact(JSON.stringify(RUN)).run_id).toBe('01M2Z')
  })

  it('se planta ante un esquema que no conoce, en vez de adivinar', () => {
    expect(() => parseArtifact(JSON.stringify({ ...RUN, schema_version: 2 }))).toThrow(/versión 2/)
  })

  it('no acepta un fichero que no es un resultado', () => {
    expect(() => parseArtifact('no es json')).toThrow(/JSON/)
    expect(() => parseArtifact(JSON.stringify({ schema_version: 1 }))).toThrow(/incompleto/)
  })
})
