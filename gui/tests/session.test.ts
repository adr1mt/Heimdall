import { describe, expect, it } from 'vitest'
import { readSession, sessionArgs } from '../src/main/session'
import { parseSession, type Session, type SessionStudent } from '../src/shared/session'
import type { Score } from '../src/shared/events'
import {
  SESSION_STATUS_TEXT,
  fromRoundText,
  nextRoundText,
  roundLines,
  sessionTally,
  sessionText
} from '../src/renderer/src/lib/session'
import {
  gradeRows,
  sessionCsv,
  sessionCsvName,
  sessionExportSummary,
  sessionGradeRows
} from '../src/renderer/src/lib/export'
import { SCALES } from '../src/renderer/src/lib/scale'
import { runArgs } from '../src/main/run'
import { parseArtifact } from '../src/shared/artifact'

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

function attempt(round: number, final: number | null, counts = false) {
  return {
    round,
    run_id: `R${round}`,
    finished_at: `2026-09-17T1${round}:00:00Z`,
    status: final === null ? ('PARTIAL' as const) : ('OK' as const),
    score:
      final === null
        ? score({ obtained: 3, evaluable: 5, total: 10, unevaluated: 5, provisional_score: 60, status: 'INCOMPLETE' })
        : score({
            obtained: (final * 10) / 100,
            evaluable: 10,
            total: 10,
            unevaluated: 0,
            provisional_score: final,
            final_score: final,
            status: 'COMPLETE'
          }),
    counts
  }
}

/**
 * Una sesión de cuatro vueltas, como la de un examen de verdad: una alumna que
 * va de 6 a 9, otro que lo tuvo todo bien en la segunda y desde entonces no se
 * corrige, y un tercero al que ninguna vuelta llegó a evaluar entero.
 */
const session: Session = {
  session_version: 1,
  kind: 'session',
  plan_hash: 'abc',
  plan: {
    check_count: 2,
    total_weight: 10,
    check_ids: ['C-1', 'C-2'],
    concurrency: 16,
    host_concurrency: 4
  },
  rounds: [1, 2, 3, 4].map((round) => ({
    round,
    run_id: `R${round}`,
    artifact: `/var/run-${round}.json`,
    started_at: `2026-09-17T1${round}:00:00Z`,
    finished_at: `2026-09-17T1${round}:00:00Z`,
    status: 'COMPLETE' as const
  })),
  students: [
    {
      student_id: 'alu1',
      name: 'Alumna Uno',
      moodle_id: 'm1',
      status: 'ACTIVE',
      score: score({
        obtained: 9,
        evaluable: 10,
        total: 10,
        unevaluated: 0,
        provisional_score: 90,
        final_score: 90,
        status: 'COMPLETE'
      }),
      from_round: 3,
      from_run_id: 'R3',
      rounds: [attempt(1, 60), attempt(2, 70), attempt(3, 90, true), attempt(4, 80)]
    },
    {
      student_id: 'alu2',
      name: 'Alumno Dos',
      status: 'FINISHED',
      score: score({
        obtained: 10,
        evaluable: 10,
        total: 10,
        unevaluated: 0,
        provisional_score: 100,
        final_score: 100,
        status: 'COMPLETE'
      }),
      from_round: 2,
      from_run_id: 'R2',
      rounds: [attempt(1, 50), attempt(2, 100, true)]
    },
    {
      student_id: 'alu3',
      name: 'Alumna Tres',
      status: 'ACTIVE',
      score: score({
        obtained: 3,
        evaluable: 5,
        total: 10,
        unevaluated: 5,
        provisional_score: 60,
        status: 'INCOMPLETE'
      }),
      from_round: 0,
      reason: 'ninguna vuelta de la sesión llegó a evaluarlo entero, así que todavía no tiene nota de la sesión',
      rounds: [attempt(1, null), attempt(2, null)]
    }
  ]
}

describe('la sesión que enseña la pantalla', () => {
  // El criterio de T064: la nota que se ve es la mejor vuelta entera, y sale
  // del motor. La aplicación no la busca ni la compara.
  it('enseña la mejor vuelta de cada alumno y de cuál sale', () => {
    const [uno] = session.students
    expect(uno.score.final_score).toBe(90)
    expect(fromRoundText(uno)).toBe('Sale de la vuelta 3')
  })

  it('no calcula nada: la mejor vuelta es la que el motor marcó', () => {
    // La cuarta vuelta es peor que la tercera y la aplicación no las compara:
    // se limita a leer `from_round`, que es lo único que dice cuál cuenta.
    const marked = session.students[0].rounds.filter((r) => r.counts).map((r) => r.round)
    expect(marked).toEqual([session.students[0].from_round])
  })

  it('dice quién ha terminado y por qué deja de corregirse', () => {
    const dos = session.students[1]
    expect(SESSION_STATUS_TEXT[dos.status]).toBe('Terminado')
    expect(nextRoundText(dos)).toContain('en la vuelta 2 ya tenía el examen entero bien')
    expect(nextRoundText(session.students[0])).toBeNull()
  })

  it('quien no tiene ninguna vuelta entera sale sin nota y con el motivo del motor', () => {
    const tres = session.students[2]
    expect(tres.from_round).toBe(0)
    expect(fromRoundText(tres)).toBe(tres.reason)
  })

  it('enseña lo que dijo cada vuelta, con la que cuenta señalada', () => {
    const lines = roundLines(session.students[0], SCALES.ten)
    expect(lines).toHaveLength(4)
    expect(lines[2]).toContain('es la que cuenta')
    expect(lines[3]).not.toContain('es la que cuenta')
  })

  it('resume la sesión sin inventarse cuentas', () => {
    expect(sessionTally(session)).toEqual({ graded: 2, finished: 1, open: 1 })
    expect(sessionText(session)).toContain('4 vueltas')
  })
})

describe('lo que se exporta de una sesión', () => {
  it('lleva la nota del motor, en la escala del profesor, y de qué vuelta sale', () => {
    const rows = sessionGradeRows(session, SCALES.ten)
    expect(rows[0]).toMatchObject({ name: 'Alumna Uno', grade: '8,3', round: '3', note: '' })
    expect(rows[1]).toMatchObject({ state: 'Terminado', grade: '10,0', round: '2' })
  })

  it('quien no tenga vuelta entera sale sin nota y con el motivo', () => {
    const tres = sessionGradeRows(session, SCALES.ten)[2]
    expect(tres.grade).toBe('')
    expect(tres.round).toBe('')
    expect(tres.note).toBe(session.students[2].reason)
  })

  it('el fichero no se puede confundir con el de una vuelta suelta', () => {
    expect(sessionCsvName(session)).toMatch(/^notas-sesion-/)
    expect(sessionExportSummary(session, SCALES.ten)).toContain('4 vueltas del examen')
  })

  it('el CSV sale con cabecera, BOM y ningún número donde no hay nota', () => {
    const csv = sessionCsv(session, SCALES.ten)
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe('alumno;identificador;moodle;estado;nota;escala;vuelta;observaciones')
    expect(lines[1]).toBe('Alumna Uno;alu1;m1;En curso;8,3;10;3;')
    expect(lines[3].split(';')[4]).toBe('')
  })
})

describe('pedirle la sesión al motor', () => {
  it('manda las vueltas en el orden en que se corrieron, sin ordenarlas', () => {
    expect(sessionArgs(['/var/run-2.json', '/var/run-1.json'])).toEqual([
      'session',
      '/var/run-2.json',
      '/var/run-1.json'
    ])
  })

  it('una vuelta por bandera en la corrección, y el directorio al final', () => {
    const args = runArgs({
      dir: '/aula',
      className: 'aula.yaml',
      sessionRounds: ['/var/run-1.json', '/var/run-2.json']
    })
    expect(args.filter((a) => a.startsWith('--session='))).toEqual([
      '--session=/var/run-1.json',
      '--session=/var/run-2.json'
    ])
    expect(args[args.length - 1]).toBe('/aula')
  })

  it('lee la sesión cuando el motor la imprime, evaluada del todo o no', () => {
    const printed = JSON.stringify(session)
    for (const code of [0, 3]) {
      const read = readSession({ code, stdout: printed, stderr: '', error: null })
      expect(read.students[0].from_round).toBe(3)
    }
  })

  // Sin denominador comparable no se enseña ninguna nota: se enseña el motivo.
  it('una sesión que el motor rechaza sale como su motivo, sin notas', () => {
    expect(() =>
      readSession({
        code: 2,
        stdout: '',
        stderr: 'heimdall session: la vuelta R2 se hizo con otro examen\n',
        error: new Error('exit 2') as NodeJS.ErrnoException
      })
    ).toThrow('la vuelta R2 se hizo con otro examen')
  })

  it('no se lee una consolidación como si fuera una sesión', () => {
    expect(() => parseSession('{"kind":"consolidation","session_version":1}')).toThrow(
      'no es una sesión'
    )
  })

  it('no se lee una sesión escrita en otra versión', () => {
    expect(() => parseSession('{"kind":"session","session_version":2}')).toThrow('versión 2')
  })
})

describe('un alumno que va de 6 a 9 en cuatro vueltas', () => {
  it('se queda con el 9 y con la vuelta de la que salió', () => {
    const uno: SessionStudent = session.students[0]
    expect(uno.rounds.map((r) => r.score.final_score)).toEqual([60, 70, 90, 80])
    expect(uno.score.final_score).toBe(90)
    expect(uno.from_round).toBe(3)
    expect(sessionGradeRows(session, SCALES.ten)[0].grade).toBe('8,3')
  })
})

describe('una vuelta que deja fuera a quien ya terminó', () => {
  // Lo que pasó de verdad contra el laboratorio: la segunda vuelta no corrige
  // al alumno terminado, así que ese alumno no trae ninguna comprobación. La
  // pantalla tiene que leerlo como «ninguna», no romperse.
  const round = {
    schema_version: 1,
    run_id: 'R2',
    engine_version: '0.1.0',
    started_at: '2026-09-21T09:42:00Z',
    finished_at: '2026-09-21T09:42:10Z',
    status: 'COMPLETE',
    exam: { path: '/aula/examen.yaml', sha256: 'x' },
    inventory: { path: '/aula/aula.yaml', sha256: 'y' },
    plan_hash: 'abc',
    plan: {
      check_count: 2,
      total_weight: 10,
      check_ids: ['C-1', 'C-2'],
      concurrency: 16,
      host_concurrency: 4
    },
    students: [
      {
        student_id: 'alumne01',
        name: 'Alumna Uno',
        status: 'EXCLUDED',
        started_at: '2026-09-21T09:42:00Z',
        finished_at: '2026-09-21T09:42:00Z',
        score: score({ obtained:0, evaluable:0,unevaluated:0,provisional_score:null,final_score:null, status: 'EXCLUDED' }),
        checks: null
      }
    ]
  }

  it('el alumno excluido se lee sin comprobaciones, y no rompe la pantalla', () => {
    const read = parseArtifact(JSON.stringify(round))
    expect(read.students[0].checks).toEqual([])
    expect(gradeRows(read, SCALES.ten)[0]).toMatchObject({
      state: 'Excluido',
      grade: '',
      pass: 0,
      note: 'sin nota: excluido del examen'
    })
  })
})
