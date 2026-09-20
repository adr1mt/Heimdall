import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_RUNS, listRuns, varDirOf } from '../src/main/history'

function emptyDir(): string {
  return mkdtempSync(join(tmpdir(), 'heimdall-history-'))
}

interface Extra {
  status?: string
  students?: number
  retryOf?: string
}

/** A minimal artifact of the shape the engine writes. */
function artifact(runId: string, startedAt: string, extra: Extra = {}): string {
  const students = Array.from({ length: extra.students ?? 2 }, (_, i) => ({
    student_id: `alu${i}`,
    name: `Alumna ${i}`,
    status: 'OK',
    started_at: startedAt,
    finished_at: startedAt,
    score: {
      obtained: 2,
      evaluable: 2,
      total: 2,
      unevaluated: 0,
      provisional_score: 100,
      final_score: 100,
      status: 'COMPLETE'
    },
    checks: []
  }))
  return JSON.stringify({
    schema_version: 1,
    run_id: runId,
    engine_version: '0.1.0-dev',
    started_at: startedAt,
    finished_at: startedAt,
    status: extra.status ?? 'COMPLETE',
    exam: { path: 'aula/ra2/examen.yaml', sha256: 'a' },
    inventory: { path: 'aula/ra2/smx2a.yaml', sha256: 'b' },
    plan_hash: 'c',
    plan: { check_count: 5, total_weight: 6, check_ids: [], concurrency: 8, host_concurrency: 4 },
    students,
    ...(extra.retryOf
      ? {
          retry_of: {
            run_id: extra.retryOf,
            artifact: `var/run-${extra.retryOf}.json`,
            run_at: startedAt,
            students: 1,
            checks: 2
          }
        }
      : {})
  })
}

function write(dir: string, name: string, body: string): void {
  writeFileSync(join(dir, name), body, 'utf-8')
}

describe('varDirOf', () => {
  it('points at the same var/ the engine was told to write into', () => {
    expect(varDirOf('/casa/ra2/examen.yaml')).toBe(join('/casa/ra2', 'var'))
  })
})

describe('listRuns', () => {
  it('is empty and not an error when the project was never corrected', async () => {
    expect(await listRuns(join(emptyDir(), 'var'))).toEqual([])
    expect(await listRuns(emptyDir())).toEqual([])
  })

  it('lists the finished runs, newest correction first', async () => {
    const dir = emptyDir()
    write(dir, 'run-A.json', artifact('A', '2026-09-01T10:00:00Z'))
    write(dir, 'run-B.json', artifact('B', '2026-09-18T09:30:00Z'))
    write(dir, 'run-C.json', artifact('C', '2026-09-10T08:00:00Z'))

    const runs = await listRuns(dir)
    expect(runs.map((r) => r.runId)).toEqual(['B', 'C', 'A'])
  })

  it('leaves out what is not a finished correction', async () => {
    const dir = emptyDir()
    write(dir, 'run-A.json', artifact('A', '2026-09-01T10:00:00Z'))
    write(dir, 'run-B.partial.json', artifact('B', '2026-09-02T10:00:00Z'))
    write(dir, 'latest.json', artifact('A', '2026-09-01T10:00:00Z'))
    write(dir, 'moodle.csv', 'nada que ver')

    expect((await listRuns(dir)).map((r) => r.runId)).toEqual(['A'])
  })

  it('says of each run what the teacher needs to recognise it', async () => {
    const dir = emptyDir()
    write(dir, 'run-A.json', artifact('A', '2026-09-18T09:30:00Z', { students: 3 }))

    const [run] = await listRuns(dir)
    expect(run).toMatchObject({
      runId: 'A',
      at: '2026-09-18T09:30:00Z',
      status: 'COMPLETE',
      exam: 'examen.yaml',
      classroom: 'smx2a.yaml',
      students: 3,
      checks: 5,
      retryOf: null,
      problem: null
    })
    expect(run.path).toBe(join(dir, 'run-A.json'))
  })

  it('says which correction a retry came from', async () => {
    const dir = emptyDir()
    write(dir, 'run-B.json', artifact('B', '2026-09-19T09:00:00Z', { retryOf: 'A' }))

    expect((await listRuns(dir))[0].retryOf).toBe('A')
  })

  it('keeps a run that cannot be read, with the reason', async () => {
    const dir = emptyDir()
    write(dir, 'run-A.json', artifact('A', '2026-09-01T10:00:00Z'))
    write(dir, 'run-B.json', '{ esto no es json')
    write(dir, 'run-C.json', JSON.stringify({ schema_version: 99, students: [], plan: {} }))

    const runs = await listRuns(dir)
    expect(runs).toHaveLength(3)
    const broken = runs.filter((r) => r.problem !== null)
    expect(broken).toHaveLength(2)
    for (const run of broken) {
      expect(run.problem).toMatch(/resultado/i)
      expect(run.runId).toBeNull()
      // It still has a date, so it lands in its place instead of at the end.
      expect(Number.isNaN(Date.parse(run.at))).toBe(false)
    }
  })

  it('does not grow without bound in a directory of a whole course', async () => {
    const dir = emptyDir()
    for (let i = 0; i < MAX_RUNS + 10; i++) {
      write(dir, `run-R${i}.json`, artifact(`R${i}`, `2026-09-0${(i % 9) + 1}T10:00:00Z`))
    }
    expect(await listRuns(dir)).toHaveLength(MAX_RUNS)
  })
})
