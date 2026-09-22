import { describe, expect, it } from 'vitest'
import { consolidateArgs, readConsolidation } from '../src/main/consolidate'
import { parseConsolidation } from '../src/shared/consolidation'
import type { Consolidation } from '../src/shared/consolidation'
import type { Score } from '../src/shared/events'
import { attemptsText, chainTally, chainText, fromRunText } from '../src/renderer/src/lib/chain'
import {
  chainCsv,
  chainExportSummary,
  chainGradeRows,
  chainCsvName
} from '../src/renderer/src/lib/export'
import { SCALES } from '../src/renderer/src/lib/scale'

function score(partial: Partial<Score>): Score {
  return {
    obtained: 0,
    evaluable: 0,
    total: 10,
    unevaluated: 10,
    provisional_score: null,
    final_score: null,
    status: 'NOT_EVALUATED',
    ...partial
  }
}

/** Una cadena de dos correcciones: alu1 se cerró en la segunda, alu2 sigue sin poder mirarse. */
const chain: Consolidation = {
  consolidation_version: 1,
  kind: 'consolidation',
  plan_hash: 'abc',
  plan: {
    check_count: 2,
    total_weight: 10,
    check_ids: ['C-1', 'C-2'],
    concurrency: 16,
    host_concurrency: 4
  },
  runs: [
    {
      run_id: 'R2',
      artifact: '/var/run-2.json',
      started_at: '2026-09-17T09:00:00Z',
      finished_at: '2026-09-17T09:05:00Z',
      status: 'PARTIAL'
    },
    {
      run_id: 'R1',
      artifact: '/var/run-1.json',
      started_at: '2026-09-16T09:00:00Z',
      finished_at: '2026-09-16T09:05:00Z',
      status: 'PARTIAL'
    }
  ],
  students: [
    {
      student_id: 'alu1',
      name: 'Alumna Uno',
      status: 'OK',
      score: score({
        obtained: 8,
        evaluable: 10,
        total: 10,
        unevaluated: 0,
        final_score: 80,
        provisional_score: 80,
        status: 'COMPLETE'
      }),
      checks: [
        {
          check_id: 'C-1',
          group: 'red',
          description: 'El servidor responde',
          weight: 5,
          status: 'PASS',
          cause: 'NONE',
          from_run: 'R1',
          from_run_at: '2026-09-16T09:05:00Z'
        },
        {
          check_id: 'C-2',
          group: 'red',
          description: 'El servicio arranca solo',
          weight: 5,
          status: 'PASS',
          cause: 'NONE',
          from_run: 'R2',
          from_run_at: '2026-09-17T09:05:00Z',
          attempts: [
            {
              run_id: 'R1',
              status: 'UNEVALUATED',
              cause: 'CONNECT_FAILED',
              finished_at: '2026-09-16T09:05:00Z'
            }
          ]
        }
      ]
    },
    {
      student_id: 'alu2',
      name: 'Alumno Dos',
      status: 'PARTIAL',
      score: score({
        obtained: 5,
        evaluable: 5,
        total: 10,
        unevaluated: 5,
        provisional_score: 100,
        status: 'INCOMPLETE'
      }),
      checks: [
        {
          check_id: 'C-1',
          group: 'red',
          description: 'El servidor responde',
          weight: 5,
          status: 'PASS',
          cause: 'NONE',
          from_run: 'R1',
          from_run_at: '2026-09-16T09:05:00Z'
        },
        {
          check_id: 'C-2',
          group: 'red',
          description: 'El servicio arranca solo',
          weight: 5,
          status: 'UNEVALUATED',
          cause: 'CONNECT_FAILED',
          detail: 'no se pudo conectar',
          from_run: 'R2',
          from_run_at: '2026-09-17T09:05:00Z',
          attempts: [
            {
              run_id: 'R1',
              status: 'UNEVALUATED',
              cause: 'CONNECT_FAILED',
              finished_at: '2026-09-16T09:05:00Z'
            }
          ]
        }
      ]
    }
  ]
}

describe('la cadena que el motor devuelve', () => {
  it('se lee tal cual cuando es una consolidacion de la version conocida', () => {
    expect(parseConsolidation(JSON.stringify(chain)).students).toHaveLength(2)
  })

  it('rechaza un artefacto de una correccion suelta', () => {
    const run = { schema_version: 1, run_id: 'R1', students: [], plan: {} }
    expect(() => parseConsolidation(JSON.stringify(run))).toThrow(/cadena de correcciones/i)
  })

  it('rechaza una version que no entiende en vez de adivinarla', () => {
    expect(() => parseConsolidation(JSON.stringify({ ...chain, consolidation_version: 2 }))).toThrow(
      /versión 2/
    )
  })

  it('rechaza lo que no es JSON', () => {
    expect(() => parseConsolidation('<html>')).toThrow(/legible/)
  })
})

describe('lo que el motor contesta', () => {
  it('pide exactamente la consolidacion de ese artefacto, sin shell', () => {
    expect(consolidateArgs('/var/run con espacios.json')).toEqual([
      'consolidate',
      '/var/run con espacios.json'
    ])
  })

  it('lee la cadena con exit 0 y tambien con exit 3', () => {
    for (const code of [0, 3]) {
      const out = { code, stdout: JSON.stringify(chain), stderr: '', error: null }
      expect(readConsolidation(out).students).toHaveLength(2)
    }
  })

  it('una cadena rechazada llega como el motivo del motor y sin ninguna nota', () => {
    const out = {
      code: 2,
      stdout: '',
      stderr:
        'heimdall consolidate: la corrección R1 se hizo con otro examen o con otra aula que R2\n',
      error: new Error('exit 2') as NodeJS.ErrnoException
    }
    expect(() => readConsolidation(out)).toThrow(/otro examen o con otra aula/)
    expect(() => readConsolidation(out)).not.toThrow(/heimdall consolidate:/)
  })

  it('un motor que ni arranca se explica igual', () => {
    const error = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
    expect(() => readConsolidation({ code: null, stdout: '', stderr: '', error })).toThrow(
      /no pudo leer la cadena/
    )
  })
})

describe('la cadena en pantalla', () => {
  it('dice cuantas correcciones se han leido juntas', () => {
    expect(chainText(chain)).toMatch(/^2 correcciones leídas juntas/)
  })

  it('cada comprobacion dice de que correccion sale', () => {
    expect(fromRunText(chain.students[0].checks[1])).toMatch(/Sale de la corrección del/)
  })

  it('y que paso antes en esa misma comprobacion', () => {
    const lines = attemptsText(chain.students[0].checks[1].attempts)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/quedó sin evaluar: no se pudo conectar con la máquina/i)
  })

  it('sin intentos previos no inventa ninguna linea', () => {
    expect(attemptsText(undefined)).toEqual([])
  })

  it('cuenta quien queda cerrado y quien no', () => {
    expect(chainTally(chain)).toEqual({ closed: 1, open: 1 })
  })
})

describe('lo que se exporta de una cadena', () => {
  const rows = chainGradeRows(chain, SCALES.ten)

  it('el alumno que quedo entero entre dos correcciones sale con su nota final', () => {
    expect(rows[0]).toMatchObject({ name: 'Alumna Uno', grade: '6,7', note: '' })
  })

  it('el que sigue sin poder comprobarse sale sin nota y con el motivo', () => {
    expect(rows[1].grade).toBe('')
    expect(rows[1].note).toMatch(/falta por comprobar 5 de 10 de peso/)
  })

  it('el fichero no se puede confundir con el de una correccion suelta', () => {
    expect(chainCsvName(chain)).toBe('notas-consolidado-20260917-090500.csv')
  })

  it('el CSV lleva una linea por alumno y la nota solo de quien la tiene', () => {
    const lines = chainCsv(chain, SCALES.ten).trimEnd().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain(';6,7;10;')
    expect(lines[2]).toContain(';;;sin nota')
  })

  it('el resumen dice cuantas correcciones se han leido', () => {
    expect(chainExportSummary(chain, SCALES.ten)).toMatch(/2 correcciones leídas juntas/)
  })
})
