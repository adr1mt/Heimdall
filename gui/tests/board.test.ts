import { describe, expect, it } from 'vitest'
import { board } from '../src/renderer/src/lib/board'
import { applyEvent, emptyRunState, type RunState } from '../src/renderer/src/lib/run-state'
import { SCALES } from '../src/renderer/src/lib/export'
import type { EngineEvent, Score } from '../src/shared/events'

const TEN = SCALES.ten

const START: EngineEvent = {
  event: 'run.start',
  seq: 1,
  ts: 't',
  contract_version: 1,
  run_id: '01M2Z',
  engine_version: '0.1.0-dev',
  plan: {
    check_count: 4,
    total_weight: 10,
    check_ids: ['p1', 'p2', 'p3', 'p4'],
    concurrency: 16,
    host_concurrency: 4
  },
  expected_checks: 12,
  students: [
    { student_id: 'alu1', name: 'Alumna Uno', excluded: false },
    { student_id: 'alu2', name: 'Alumne Dos', excluded: false },
    { student_id: 'alu3', name: 'Alumna Tres', excluded: true }
  ]
}

function check(studentId: string, seq: number, status: 'PASS' | 'UNEVALUATED' = 'PASS'): EngineEvent {
  return {
    event: 'check.end',
    seq,
    ts: 't',
    student_id: studentId,
    check_id: `p${seq}`,
    weight: 1,
    status,
    cause: status === 'UNEVALUATED' ? 'CONNECT_FAILED' : 'NONE',
    duration_ms: null
  }
}

function complete(score: number): Score {
  return {
    obtained: score / 10,
    evaluable: 10,
    total: 10,
    unevaluated: 0,
    provisional_score: score,
    final_score: score,
    status: 'COMPLETE'
  }
}

const INCOMPLETE: Score = {
  obtained: 4,
  evaluable: 6,
  total: 10,
  unevaluated: 4,
  provisional_score: 67,
  final_score: null,
  status: 'INCOMPLETE'
}

function end(studentId: string, seq: number, score: Score, status: 'OK' | 'PARTIAL'): EngineEvent {
  return { event: 'student.end', seq, ts: 't', student_id: studentId, status, score }
}

function replay(events: EngineEvent[]): RunState {
  return events.reduce(applyEvent, emptyRunState())
}

describe('el tablero del proyector', () => {
  it('pinta la clase entera antes de que llegue nada', () => {
    const view = board(replay([START]), TEN)
    expect(view.rows.map((r) => r.name)).toEqual(['Alumna Uno', 'Alumne Dos', 'Alumna Tres'])
    expect(view.rows.map((r) => r.state)).toEqual(['waiting', 'waiting', 'excluded'])
    expect(view.rows.every((r) => r.percent === 0)).toBe(true)
  })

  it('el alumnado excluido no cuenta como clase ni como terminado', () => {
    const view = board(replay([START]), TEN)
    expect(view.students).toBe(2)
    expect(view.finished).toBe(0)
  })

  it('el progreso se mide sobre las comprobaciones del PLAN, iguales para todos', () => {
    const view = board(replay([START, check('alu1', 2), check('alu1', 3)]), TEN)
    expect(view.rows[0].done).toBe(2)
    expect(view.rows[0].total).toBe(4)
    expect(view.rows[0].percent).toBe(50)
    // El que no ha recibido nada sigue con la barra entera por llenar: no
    // parece terminado por no haber llegado nada suyo.
    expect(view.rows[1].percent).toBe(0)
  })

  it('FINALIZADO lo dice el motor, no la cuenta de comprobaciones', () => {
    const state = replay([START, check('alu1', 2), end('alu1', 3, complete(80), 'OK')])
    const view = board(state, TEN)
    // Solo llegó una de cuatro y aun así está terminado: el motor lo cerró.
    expect(view.rows[0].state).toBe('finished')
    expect(view.finished).toBe(1)
  })

  it('la nota sale en la escala del profesor y es la que publicó el motor', () => {
    const state = replay([START, end('alu1', 2, complete(80), 'OK')])
    expect(board(state, TEN).rows[0].grade).toBe('8,0')
    expect(board(state, SCALES.hundred).rows[0].grade).toBe('80')
  })

  it('sin nota final no hay número, ni siquiera el provisional', () => {
    const state = replay([START, check('alu2', 2, 'UNEVALUATED'), end('alu2', 3, INCOMPLETE, 'PARTIAL')])
    const row = board(state, TEN).rows[1]
    expect(row.grade).toBe('')
    expect(row.note).not.toBe('')
    expect(row.note).not.toContain('67')
  })

  it('no aparece ninguna dirección de máquina en nada de lo que proyecta', () => {
    const state = replay([
      START,
      check('alu1', 2),
      check('alu2', 3, 'UNEVALUATED'),
      end('alu1', 4, complete(100), 'OK'),
      end('alu2', 5, INCOMPLETE, 'PARTIAL')
    ])
    const text = JSON.stringify(board(state, TEN))
    expect(text).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/)
    expect(text).not.toContain('ssh')
  })

  it('sin PLAN todavía no divide por cero', () => {
    const view = board(emptyRunState(), TEN)
    expect(view.rows).toEqual([])
    expect(view.students).toBe(0)
  })
})
