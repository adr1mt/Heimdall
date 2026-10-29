import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { SavedExam } from '../src/shared/exam-record'

let useApp: typeof import('../src/renderer/src/stores/app').useApp
let useExamRecord: typeof import('../src/renderer/src/stores/exam-record').useExamRecord
let useRun: typeof import('../src/renderer/src/stores/run').useRun
let pauseExam: typeof import('../src/renderer/src/lib/exam-actions').pauseExam
let resumeExam: typeof import('../src/renderer/src/lib/exam-actions').resumeExam
let prepareAnotherExam: typeof import('../src/renderer/src/lib/exam-actions').prepareAnotherExam
const api = { setExamMode: vi.fn(), savedExam: vi.fn(), listClasses: vi.fn(), secretRefs: vi.fn() }
let saved: SavedExam
beforeAll(async () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() })
  ;({ useApp } = await import('../src/renderer/src/stores/app'))
  ;({ useExamRecord } = await import('../src/renderer/src/stores/exam-record'))
  ;({ useRun } = await import('../src/renderer/src/stores/run'))
  ;({ pauseExam, resumeExam, prepareAnotherExam } = await import('../src/renderer/src/lib/exam-actions'))
})
beforeEach(() => {
  vi.stubGlobal('window', { heimdall: api })
  vi.clearAllMocks()
  useExamRecord.getState().reset(); useRun.getState().reset()
  saved = { record: { version: 1, id: 'old', examPath: '/tmp/examen.yaml', classId: 'class', className: 'Ficticia', title: 'Ficticio', createdAt: '', state: 'PAUSED', passMark: 70, examHash: '', inventoryHash: '', inventoryName: '', roster: [], rounds: [{ path: '/tmp/R1', runId: 'R1', sha256: '' }], delivery: {} }, session: null }
  useExamRecord.getState().accept(saved)
  useApp.setState({ project: { dir: '/tmp', examPath: '/tmp/examen.yaml', name: 'Ficticio' }, classId: 'class', notice: null, preparingExam: false, exam: { active: false, everyMinutes: 5, nextAt: null, passes: 0 }, examRounds: ['/tmp/R1'] })
  useApp.getState().stopExam()
  api.listClasses.mockResolvedValue([{ id: 'class', password: 'fictitious-secret' }])
  api.secretRefs.mockResolvedValue(['PASSWORD'])
  api.savedExam.mockImplementation(async () => structuredClone(saved))
  api.setExamMode.mockImplementation(async ({ active }: { active: boolean }) => { saved.record.state = active ? 'ACTIVE' : 'PAUSED' })
})
afterEach(() => { useApp.getState().setNotice(null) })

it('resumes without clearing compatible rounds and pauses without finalizing or scheduling another pass', async () => {
  await resumeExam(5)
  expect(api.setExamMode.mock.calls[0][0]).toMatchObject({ active: true, recordId: 'old', secrets: { PASSWORD: 'fictitious-secret' } })
  expect(useApp.getState().exam.active).toBe(true)
  expect(useApp.getState().examRounds).toEqual(['/tmp/R1'])
  await pauseExam()
  expect(useApp.getState().exam.active).toBe(false)
  expect(useApp.getState().exam.nextAt).toBeNull()
  expect(useExamRecord.getState().saved?.record.state).toBe('PAUSED')
  expect(useExamRecord.getState().saved?.record.closedAt).toBeUndefined()
  expect(useApp.getState().examRounds).toEqual(['/tmp/R1'])
  expect(useExamRecord.getState().prompt).toBe(false)
})

it('uses the new compatible record returned by main when criteria changed', async () => {
  api.setExamMode.mockImplementationOnce(async () => { saved = { ...saved, record: { ...saved.record, id: 'new', state: 'ACTIVE', rounds: [] } } })
  await resumeExam(10)
  expect(useExamRecord.getState().saved?.record.id).toBe('new')
  expect(useApp.getState().examRounds).toEqual([])
  expect(useApp.getState().exam.active).toBe(true)
})

it('cannot resume on top of an active pass', async () => {
  useRun.getState().begin()
  await resumeExam(5)
  expect(api.setExamMode).not.toHaveBeenCalled()
  expect(useApp.getState().exam.active).toBe(false)
})

it('stops main scheduling if recovery fails during resume and reports the error', async () => {
  api.savedExam.mockRejectedValueOnce(new Error('Resultado histórico ilegible'))
  await resumeExam(5)
  expect(api.setExamMode.mock.calls.at(-1)?.[0]).toEqual({ active: false })
  expect(useApp.getState().exam.active).toBe(false)
  expect(useApp.getState().notice).toContain('Resultado histórico ilegible')
})

it('resumes a paused countdown without immediately correcting or resetting its wait', async () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(1000000)
    useApp.getState().startExam(5)
    useApp.getState().examPassStarted()
    useApp.getState().examPassFinished()
    vi.advanceTimersByTime(60000)
    await pauseExam()
    vi.advanceTimersByTime(120000)
    await resumeExam(5)
    expect(useApp.getState().exam.nextAt).toBe(Date.now() + 240000)
    expect(useApp.getState().exam.passes).toBe(1)
    expect(useApp.getState().examRounds).toEqual(['/tmp/R1'])
  } finally { vi.useRealTimers() }
})

it('waits an interval when resuming a recovered record without an in-memory countdown', async () => {
  await resumeExam(5)
  expect(useApp.getState().exam.nextAt).toBeGreaterThanOrEqual(Date.now() + 299900)
})

it('prepares a blank classroom after closure without modifying saved results or calling a write API', () => {
  saved.record.state = 'FINALIZED'
  useExamRecord.getState().accept(saved)
  const original = structuredClone(saved)
  prepareAnotherExam()
  expect(saved).toEqual(original)
  expect(useApp.getState()).toMatchObject({ preparingExam: true, classId: null, view: 'correct', examRounds: [], retry: null })
  expect(useApp.getState().project?.examPath).toBe('/tmp/examen.yaml')
  expect(useExamRecord.getState().saved).toBeNull()
  expect(useRun.getState().artifact).toBeNull()
  expect(api.setExamMode).not.toHaveBeenCalled()
  useApp.getState().setClassId('class')
  expect(useApp.getState().preparingExam).toBe(true)
})

it('refuses to clear an unfinished session', () => {
  prepareAnotherExam()
  expect(useExamRecord.getState().saved?.record.id).toBe('old')
  expect(useApp.getState().classId).toBe('class')
})
