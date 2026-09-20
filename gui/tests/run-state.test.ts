import { describe, expect, it } from 'vitest'
import {
  applyClosed,
  applyEvent,
  emptyRunState,
  runPercent,
  type RunState
} from '../src/renderer/src/lib/run-state'
import type { EngineEvent } from '../src/shared/events'

const START: EngineEvent = {
  event: 'run.start',
  seq: 1,
  ts: 't',
  contract_version: 1,
  run_id: '01M2Z',
  engine_version: '0.1.0-dev',
  plan: {
    check_count: 2,
    total_weight: 2,
    check_ids: ['p1', 'p2'],
    concurrency: 16,
    host_concurrency: 4
  },
  expected_checks: 4,
  students: [
    { student_id: 'alu1', name: 'Alumna Uno', excluded: false },
    { student_id: 'alu2', name: 'Alumne Dos', excluded: false },
    { student_id: 'alu3', name: 'Alumna Tres', excluded: true }
  ]
}

function check(studentId: string, status: 'PASS' | 'FAIL' | 'UNEVALUATED', seq: number): EngineEvent {
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

function replay(events: EngineEvent[]): RunState {
  return events.reduce(applyEvent, emptyRunState())
}

describe('applyEvent', () => {
  it('draws the whole class before a machine is touched', () => {
    const state = replay([START])
    expect(state.phase).toBe('running')
    expect(state.students).toHaveLength(3)
    expect(state.students[2].status).toBe('EXCLUDED')
  })

  it('moves the bar over real checks, not over characters', () => {
    const state = replay([START, check('alu1', 'PASS', 2), check('alu2', 'FAIL', 3)])
    expect(state.done).toBe(2)
    expect(runPercent(state)).toBe(50)
    expect(state.students[0].pass).toBe(1)
    expect(state.students[1].fail).toBe(1)
  })

  it('counts checks of interleaved students to their own student', () => {
    const state = replay([
      START,
      check('alu2', 'PASS', 2),
      check('alu1', 'UNEVALUATED', 3),
      check('alu2', 'PASS', 4)
    ])
    expect(state.students[0].unevaluated).toBe(1)
    expect(state.students[1].pass).toBe(2)
  })

  it('keeps the score the engine published, untouched', () => {
    const score = {
      obtained: 1,
      evaluable: 1,
      total: 2,
      unevaluated: 1,
      provisional_score: 100,
      final_score: null,
      status: 'INCOMPLETE' as const
    }
    const state = replay([
      START,
      { event: 'student.end', seq: 5, ts: 't', student_id: 'alu1', status: 'PARTIAL', score }
    ])
    expect(state.students[0].score).toEqual(score)
    expect(state.students[0].score?.final_score).toBeNull()
  })

  it('stops instead of guessing when the contract is not the one it knows', () => {
    const state = replay([{ ...START, contract_version: 2 } as EngineEvent])
    expect(state.phase).toBe('finished')
    expect(state.problem).toMatch(/contrato/)
    expect(state.start).toBeNull()
  })

  it('closes the run with run.end', () => {
    const state = replay([
      START,
      {
        event: 'run.end',
        seq: 9,
        ts: 't',
        status: 'CANCELLED',
        exit_code: 4,
        artifact: 'var/run-01M2Z.json',
        counts: { students: 2, pass: 1, fail: 0, unevaluated: 3 }
      }
    ])
    expect(state.phase).toBe('finished')
    expect(state.end?.artifact).toBe('var/run-01M2Z.json')
  })
})

describe('runPercent', () => {
  it('is unknown until the PLAN says how many checks there are', () => {
    expect(runPercent(emptyRunState())).toBeNull()
  })
})

describe('applyClosed', () => {
  it('calls a run that never closed unfinished, whatever the exit code', () => {
    const state = applyClosed(replay([START]), { exitCode: 0, stderr: '' })
    expect(state.phase).toBe('finished')
    expect(state.problem).toMatch(/sin cerrar/)
  })

  it('explains an invalid configuration with what the engine said', () => {
    const state = applyClosed(emptyRunState(), {
      exitCode: 2,
      stderr: 'aula.yaml:4: contraseña literal en el inventario'
    })
    expect(state.problem).toMatch(/no es válida/)
    expect(state.problem).toMatch(/aula\.yaml:4/)
  })

  it('says nothing more when run.end already closed the run', () => {
    const closed = replay([
      START,
      {
        event: 'run.end',
        seq: 9,
        ts: 't',
        status: 'COMPLETE',
        exit_code: 0,
        artifact: 'var/run.json',
        counts: { students: 2, pass: 4, fail: 0, unevaluated: 0 }
      }
    ])
    expect(applyClosed(closed, { exitCode: 0, stderr: '' }).problem).toBeNull()
  })
})
