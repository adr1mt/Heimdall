import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ExamRecords, digest } from '../src/main/exam-record'
import { aulaYaml, aulaFileName } from '../src/shared/aula'
import type { ClassGroup } from '../src/shared/classes'
import type { Session } from '../src/shared/session'
import { validRun } from './fixtures/valid-run'
import { sessionGrade } from '../src/renderer/src/lib/session-grade'
import { savedExamCsv, savedExamRows, sessionCsv, sessionGradeRows, moodleRows } from '../src/renderer/src/lib/export'
import { SCALES } from '../src/renderer/src/lib/scale'
import { sendFinalReports } from '../src/main/final-reports'

const stubs = vi.hoisted(() => ({ session: vi.fn(), deliver: vi.fn() }))
vi.mock('../src/main/session', () => ({ readExamSession: stubs.session }))
vi.mock('../src/main/deliver', () => ({ deliverReports: stubs.deliver }))
let root: string, exam: string, data: string, records: ExamRecords
const group: ClassGroup = { id: 'c1', name: 'Clase ficticia', password: 'private-password', columns: [], students: [
  { id: 'fake', name: 'Ficticio', contact: 'fake@example.invalid', host: '192.0.2.1', user: 'alumno', port: '22', fields: {} }
] }

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'heimdall-sessions-')); exam = join(root, 'examen.yaml'); data = join(root, 'data')
  mkdirSync(join(root, 'var')); writeFileSync(exam, 'examen: Ficticio\n')
  records = new ExamRecords(data, 'engine')
  stubs.session.mockReset(); stubs.deliver.mockReset()
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function artifact(id: string, sourceGroup = group) {
  const run = validRun()
  run.run_id = id; run.exam.path = exam; run.exam.sha256 = digest(readFileSync(exam)); run.inventory.path = join(root, aulaFileName(sourceGroup)); run.inventory.sha256 = digest(aulaYaml(sourceGroup))
  const path = join(root, 'var', `run-${id}.json`)
  writeFileSync(path, JSON.stringify(run))
  return { path, run }
}
function session(paths: string[]): Session {
  const rounds = paths.map((path, i) => ({ round: i + 1, run_id: `R${i+1}`, artifact: path, started_at: '2026-10-28T10:00:00Z', finished_at: '2026-10-28T10:01:00Z', status: 'COMPLETE' as const }))
  return { session_version: 1, kind: 'session', plan_hash: 'c'.repeat(64), plan: validRun().plan, rounds,
    students: [{ student_id: 'fake', name: 'Ficticio', moodle_id: 'fake@example.invalid', status: 'FINISHED', score: validRun().students[0].score, from_round: 1, from_run_id: 'R1', rounds: [] }] }
}

describe('durable exam provenance', () => {
  it('reopens the same compatible session without storing duplicate grades, output or secrets', async () => {
    const record = records.prepare(exam, group)
    records.begin(record)
    const { path } = artifact('R1'); records.append(record, path); records.recover(record)
    const reopened = new ExamRecords(data, 'engine')
    const recovered = reopened.prepare(exam, group)
    expect(recovered.id).toBe(record.id)
    stubs.session.mockResolvedValue(session([path]))
    expect((await reopened.view(recovered)).session?.students[0].score.final_score).toBe(100)
    expect(stubs.session).toHaveBeenCalledWith('engine', [path])
    const metadata = readFileSync(join(records.directory(record), 'session.json'), 'utf8')
    expect(metadata).not.toMatch(/final_score|obtained|stdout|private-password/)
    expect(statSync(join(records.directory(record), 'session.json')).mode & 0o777).toBe(0o600)
    expect(readFileSync(join(records.directory(record), record.inventoryName), 'utf8')).not.toContain(group.password)
  })
  it('recovers a committed artifact after process death before run.end', () => {
    const record = records.prepare(exam, group); records.begin(record)
    const { path } = artifact('R1')
    const reopened = new ExamRecords(data, 'engine'), recovered = reopened.get(exam, group.id)!
    reopened.recover(recovered)
    expect(recovered.rounds.map(r => r.path)).toEqual([path])
    expect(recovered.pending).toBeUndefined()
  })
  it('starts a separate record when exam criteria or classroom change; returning to old criteria never merges epochs', () => {
    const first = records.prepare(exam, group)
    writeFileSync(exam, 'examen: Otro criterio\n')
    const next = records.prepare(exam, group)
    expect(next.id).not.toBe(first.id)
    writeFileSync(exam, 'examen: Ficticio\n')
    const third = records.prepare(exam, group)
    expect(third.id).not.toBe(first.id)
    const moved = records.prepare(exam, { ...group, students: [{ ...group.students[0], host: '192.0.2.2' }] })
    expect(moved.id).not.toBe(third.id)
    expect(records.list(exam, group.id)).toHaveLength(4)
  })
  it('refuses to mix incompatible artifacts or silently accept missing/modified historical evidence', async () => {
    const record = records.prepare(exam, group), first = artifact('R1'); records.append(record, first.path)
    const other = artifact('R2'); other.run.plan_hash = 'd'.repeat(64); writeFileSync(other.path, JSON.stringify(other.run))
    expect(() => records.append(record, other.path)).toThrow(/otros criterios/)
    writeFileSync(first.path, JSON.stringify({ ...first.run, run_id: 'CHANGED' }))
    await expect(records.view(record)).rejects.toThrow(/histórico ha cambiado/)
    expect(stubs.session).not.toHaveBeenCalled()
    rmSync(first.path)
    await expect(records.view(record)).rejects.toThrow(/No se encuentra/)
  })
  it('resumes FINALIZING after restart, freezes origins, is idempotent and opens a new session for the next correction', async () => {
    const record = records.prepare(exam, group); records.begin(record)
    const { path } = artifact('R1')
    record.state = 'FINALIZING'; records.save(record)
    const reopened = new ExamRecords(data, 'engine'), recovered = reopened.get(exam, group.id)!
    expect(() => reopened.begin(recovered)).toThrow(/no acepta/)
    stubs.session.mockResolvedValue(session([path]))
    const final = await reopened.finalize(recovered)
    expect(final.record).toMatchObject({ state: 'FINALIZED', finalOrigins: [{ studentId: 'fake', runId: 'R1' }] })
    const closed = final.record.closedAt
    expect((await reopened.finalize(recovered)).record.closedAt).toBe(closed)
    expect(() => reopened.append(recovered, path)).toThrow(/finalizado/)
    expect(reopened.prepare(exam, group).id).not.toBe(record.id)
    expect(JSON.parse(readFileSync(path, 'utf8')).run_id).toBe('R1')
  })
  it('finalizes without a round as no grade, never zero', async () => {
    const record = records.prepare(exam, group)
    const saved = await records.finalize(record)
    expect(saved.session).toBeNull(); expect(saved.record.finalOrigins).toEqual([])
    expect(saved.record.roster.map(s => s.name)).toEqual(['Ficticio'])
    expect(stubs.session).not.toHaveBeenCalled()
  })
})

it('shows and exports the authoritative best grade while keeping last-round checks', () => {
  const run = validRun(), answer = session(['/R1', '/R2'])
  run.students[0].score = { ...run.students[0].score, obtained: 0, final_score: 0, provisional_score: 0 }
  run.students[0].checks[0].status = 'FAIL'
  const record = records.prepare(exam, group); record.state = 'FINALIZED'
  const projected = sessionGrade(run.students[0], { record, session: answer })
  expect(projected.student.score.final_score).toBe(100)
  expect(projected.student.checks[0].status).toBe('FAIL')
  expect(projected.origin).toBe('Vuelta 1'); expect(projected.label).toBe('Nota final')
  expect(sessionGradeRows(answer, SCALES.ten)[0]).toMatchObject({ grade: '10,0', round: '1' })
  expect(sessionCsv(answer, SCALES.ten)).toContain('10,0')
  expect(moodleRows(sessionGradeRows(answer, SCALES.ten))[0]).toMatchObject({ grade: '10,0', email: 'fake@example.invalid' })
})

it('sends each final report with its best-round artifact, persists receipts, and retries only failures after restart', async () => {
  const record = records.prepare(exam, group), first = artifact('R1'), second = artifact('R2')
  records.append(record, first.path); records.append(record, second.path)
  const answer = session([first.path, second.path])
  stubs.session.mockResolvedValue(answer)
  await records.finalize(record)
  stubs.deliver.mockResolvedValueOnce({ file: 'x', students: [{ student_id: 'fake', name: 'Ficticio', delivered: false, reason: 'sin conexión' }] })
  await sendFinalReports(records, record, 'engine', group.password, SCALES.ten)
  expect(stubs.deliver.mock.calls[0][1]).toBe(first.path)
  const pages = stubs.deliver.mock.calls[0][4]
  expect(Object.keys(pages)).toEqual(['fake'])
  expect(pages.fake).toContain('Informe final'); expect(pages.fake).toContain('Vuelta 1')
  expect(pages.fake).not.toContain(group.password)
  const reopened = new ExamRecords(data, 'engine'), recovered = reopened.get(exam, group.id)!
  expect(recovered.delivery.fake).toMatchObject({ state: 'FAILED', reason: 'sin conexión' })
  stubs.deliver.mockResolvedValue({ file: 'x', students: [{ student_id: 'fake', name: 'Ficticio', delivered: true }] })
  await sendFinalReports(reopened, recovered, 'engine', group.password, SCALES.ten)
  expect(reopened.get(exam, group.id)?.delivery.fake.state).toBe('SENT')
  await sendFinalReports(reopened, recovered, 'engine', group.password, SCALES.hundred)
  expect(stubs.deliver).toHaveBeenCalledTimes(2)
  expect(recovered.reportScale?.id).toBe('ten')
})

it('empty final epochs export blank grades and preserve their evaluation threshold', async () => {
  const record = records.prepare(exam, group, false, 60)
  const saved = await records.finalize(record)
  expect(savedExamRows(saved, SCALES.ten)[0]).toMatchObject({ grade: '', round: '', state: 'Finalizado' })
  expect(savedExamCsv(saved, SCALES.ten)).toContain('Sin nota final')
  expect(moodleRows(savedExamRows(saved, SCALES.ten))[0].grade).toBe('')
  const next = records.prepare(exam, group, false, 70)
  expect(next.id).not.toBe(record.id)
  expect(next.passMark).toBe(70)
})

it('a changed display threshold starts another compatible epoch without modifying the previous one', () => {
  const first = records.prepare(exam, group, false, 70)
  const next = records.prepare(exam, group, false, 60)
  expect(next.id).not.toBe(first.id)
  expect(records.get(exam, group.id, first.id)?.passMark).toBe(70)
})

it('keeps successful recipients out of a partial-delivery retry and isolates their pages', async () => {
  const classroom = { ...group, students: [...group.students, { ...group.students[0], id: 'second', name: 'Segunda ficticia', contact: 'second@example.invalid' }] }
  const record = records.prepare(exam, classroom), first = artifact('R1', classroom)
  first.run.students.push({ ...structuredClone(first.run.students[0]), student_id: 'second', name: 'Segunda ficticia' })
  writeFileSync(first.path, JSON.stringify(first.run)); records.append(record, first.path)
  const answer = session([first.path])
  answer.students.push({ ...structuredClone(answer.students[0]), student_id: 'second', name: 'Segunda ficticia' })
  stubs.session.mockResolvedValue(answer); await records.finalize(record)
  stubs.deliver.mockResolvedValueOnce({ students: [{ student_id: 'fake', name: 'Ficticio', delivered: true }, { student_id: 'second', name: 'Segunda ficticia', delivered: false, reason: 'apagado' }] })
  await sendFinalReports(records, record, 'engine', group.password, SCALES.ten)
  const pages = stubs.deliver.mock.calls[0][4]
  expect(Object.keys(pages)).toEqual(['fake', 'second'])
  expect(pages.fake).not.toContain('Segunda ficticia')
  expect(pages.second).not.toContain('<h1>Ficticio</h1>')
  const reopened = new ExamRecords(data, 'engine'), recovered = reopened.get(exam, classroom.id)!
  stubs.deliver.mockResolvedValueOnce({ students: [{ student_id: 'second', name: 'Segunda ficticia', delivered: true }] })
  await sendFinalReports(reopened, recovered, 'engine', group.password, SCALES.ten)
  expect(Object.keys(stubs.deliver.mock.calls[1][4])).toEqual(['second'])
  expect(reopened.get(exam, classroom.id)?.delivery.fake.state).toBe('SENT')
  expect(reopened.get(exam, classroom.id)?.delivery.second.state).toBe('SENT')
})

it('an earlier renderer read cannot replace an accepted final closure', async () => {
  const { useExamRecord } = await import('../src/renderer/src/stores/exam-record')
  const record = records.prepare(exam, group)
  let resolveRead!: (saved: unknown) => void
  vi.stubGlobal('window', { heimdall: { savedExam: () => new Promise(resolve => { resolveRead = resolve }) } })
  useExamRecord.getState().reset()
  const reading = useExamRecord.getState().load(exam, group.id)
  useExamRecord.getState().accept({ record: { ...record, state: 'FINALIZED', closedAt: '2026-10-28T10:00:00Z' }, session: null })
  resolveRead({ record, session: null })
  expect(await reading).toBeNull()
  expect(useExamRecord.getState().saved?.record.state).toBe('FINALIZED')
  vi.unstubAllGlobals()
})

it('pauses without freezing grades, survives restart and resumes the same compatible rounds', async () => {
  const record = records.prepare(exam, group)
  records.begin(record)
  const first = artifact('R1')
  records.pause(record)
  expect(record.state).toBe('PAUSED')
  expect(() => records.begin(record)).toThrow(/no acepta/)
  records.append(record, first.path); records.recover(record)
  const before = readFileSync(first.path, 'utf8')
  const reopened = new ExamRecords(data, 'engine'), recovered = reopened.get(exam, group.id)!
  expect(recovered.state).toBe('PAUSED')
  expect(recovered.closedAt).toBeUndefined()
  expect(recovered.finalOrigins).toBeUndefined()
  expect(recovered.delivery).toEqual({})
  const resumed = reopened.prepare(exam, group)
  expect(resumed.id).toBe(record.id)
  expect(resumed.state).toBe('ACTIVE')
  expect(resumed.rounds.map(round => round.runId)).toEqual(['R1'])
  reopened.begin(resumed)
  const second = artifact('R2'); reopened.append(resumed, second.path); reopened.recover(resumed)
  stubs.session.mockResolvedValue(session([first.path, second.path]))
  const final = await reopened.finalize(resumed)
  expect(final.record.finalOrigins).toEqual([{ studentId: 'fake', runId: 'R1' }])
  expect(final.session?.students[0].score.final_score).toBe(100)
  expect(readFileSync(first.path, 'utf8')).toBe(before)
})

it('separates incompatible criteria on resume and can explicitly resume an older compatible paused session', () => {
  const first = records.prepare(exam, group)
  const result = artifact('R1'); records.append(first, result.path); records.pause(first)
  const before = readFileSync(result.path, 'utf8')
  writeFileSync(exam, 'examen: Otro criterio\n')
  const other = records.prepare(exam, group, false, 70, first.id)
  expect(other.id).not.toBe(first.id)
  expect(other.rounds).toEqual([])
  expect(records.get(exam, group.id, first.id)?.state).toBe('PAUSED')
  records.pause(other)
  writeFileSync(exam, 'examen: Ficticio\n')
  const resumed = records.prepare(exam, group, false, 70, first.id)
  expect(resumed.id).toBe(first.id)
  expect(resumed.rounds.map(round => round.runId)).toEqual(['R1'])
  expect(readFileSync(result.path, 'utf8')).toBe(before)
})

it('pausing or rereading a finalized session cannot reopen it or change frozen origins', async () => {
  const record = records.prepare(exam, group)
  const first = artifact('R1'); records.append(record, first.path)
  stubs.session.mockResolvedValue(session([first.path]))
  await records.finalize(record)
  const before = readFileSync(join(records.directory(record), 'session.json'), 'utf8')
  records.pause(record)
  await records.view(record)
  expect(readFileSync(join(records.directory(record), 'session.json'), 'utf8')).toBe(before)
})
