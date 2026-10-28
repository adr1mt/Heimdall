import { afterEach, expect, it, vi } from 'vitest'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { IPC } from '../src/shared/ipc'
import { aulaFileName, aulaYaml } from '../src/shared/aula'
import type { ClassGroup } from '../src/shared/classes'
import { digest, ExamRecords } from '../src/main/exam-record'
import { validRun } from './fixtures/valid-run'

const state = vi.hoisted(() => ({ data: '', handlers: new Map<string, (...args: any[]) => any>(), session: vi.fn() }))
vi.mock('electron', () => ({ app: { getPath: () => state.data }, ipcMain: { handle: (key: string, fn: (...args: any[]) => any) => state.handlers.set(key, fn) },
  powerSaveBlocker: { start: () => 1, isStarted: () => false, stop: () => {} }, dialog: {}, shell: {} }))
vi.mock('../src/main/session', () => ({ readExamSession: state.session }))
let root = ''
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }) })

it.each([false, true])('finalization stops starts immediately and waits for the active artifact (changed criteria=%s)', async changed => {
  vi.resetModules()
  root = mkdtempSync(join(tmpdir(), 'heimdall-finalize-'))
  state.data = join(root, 'profile'); mkdirSync(state.data); mkdirSync(join(root, 'var'))
  const exam = join(root, 'examen.yaml'), gate = join(root, 'continue'), engine = join(root, 'engine'), path = join(root, 'var', 'run-R1.json')
  writeFileSync(exam, 'examen: Ficticio\n')
  const group: ClassGroup = { id: 'fake', name: 'Ficticia', password: '', columns: [], students: [{ id: 'fake', name: 'Ficticio', host: '192.0.2.1', user: 'alumno', port: '22', contact: '', fields: {} }] }
  writeFileSync(join(state.data, 'classes.json'), JSON.stringify({ classes: [group] }))
  const run = validRun(); run.exam.path = exam; run.exam.sha256 = digest(readFileSync(exam)); run.inventory.path = join(root, aulaFileName(group)); run.inventory.sha256 = digest(aulaYaml(group))
  const fixture = join(root, 'fixture.json'); writeFileSync(fixture, JSON.stringify(run))
  const end = { event: 'run.end', seq: 2, ts: 't', status: 'COMPLETE', exit_code: 0, artifact: path, counts: { students: 1, pass: 1, fail: 0, unevaluated: 0 } }
  // The test controls completion; finalization must never send SIGINT.
  writeFileSync(engine, `#!/bin/sh\nread line\ntrap 'exit 44' INT\nprintf '%s\\n' '{"event":"student.start","seq":1,"ts":"t","student_id":"fake","name":"Ficticio"}'\nwhile [ ! -f '${gate}' ]; do sleep 0.02; done\ncp '${fixture}' '${path}'\nprintf '%s\\n' '${JSON.stringify(end)}'\n`)
  chmodSync(engine, 0o755)
  writeFileSync(join(state.data, 'settings.json'), JSON.stringify({ enginePath: engine }))
  state.session.mockResolvedValue({ session_version: 1, kind: 'session', plan_hash: run.plan_hash, plan: run.plan,
    rounds: [{ round: 1, run_id: run.run_id, artifact: path, started_at: run.started_at, finished_at: run.finished_at, status: run.status }],
    students: [{ student_id: 'fake', name: 'Ficticio', status: 'FINISHED', score: run.students[0].score, from_round: 1, from_run_id: run.run_id, rounds: [] }] })
  const ipc = await import('../src/main/ipc'); ipc.registerIpc()
  await state.handlers.get(IPC.setExamMode)!(null, { active: true })
  await new Promise<void>(resolve => {
    state.handlers.get(IPC.startRun)!({ sender: { isDestroyed: () => false, send: (channel: string) => { if (channel === IPC.runEvent) resolve() } } }, { examPath: exam, classId: group.id, secrets: {} })
  })
  if (changed) writeFileSync(exam, 'examen: Criterios nuevos\n')
  let ended = false
  const first = state.handlers.get(IPC.finishExam)!(null, exam, group.id) as Promise<any>
  first.then(() => { ended = true })
  const doubleClick = state.handlers.get(IPC.finishExam)!(null, exam, group.id)
  expect(doubleClick).toBe(first)
  expect(ipc.isExamModeActive()).toBe(false)
  expect(ipc.isRunActive()).toBe(true)
  expect(ended).toBe(false)
  expect(new ExamRecords(state.data, engine).get(exam, group.id)?.state).toBe('FINALIZING')
  expect(() => state.handlers.get(IPC.startRun)!({}, { examPath: exam, classId: group.id, secrets: {} })).toThrow(/marcha|finalizando/)
  writeFileSync(gate, '')
  const saved = await first
  expect(ipc.isRunActive()).toBe(false)
  expect(saved.record.state).toBe('FINALIZED')
  expect(saved.record.closedAt).toBeTruthy()
  expect(JSON.parse(readFileSync(path, 'utf8')).status).toBe('COMPLETE')
  expect(JSON.parse(readFileSync(path, 'utf8')).students[0].score.final_score).toBe(100)
  if (changed) {
    expect(saved.session).toBeNull()
    expect(new ExamRecords(state.data, engine).list(exam, group.id)).toHaveLength(2)
  } else {
    expect(saved.session.students[0].score.final_score).toBe(100)
  }
  // This query simulates a fresh renderer, reading the durable finalized state.
  const reopened = await state.handlers.get(IPC.savedExam)!(null, exam, group.id)
  expect(reopened.record.closedAt).toBe(saved.record.closedAt)
})
