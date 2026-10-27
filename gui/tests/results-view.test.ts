import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_FILTERS, exploreResults, filterRun, hasSSHConnection } from '../src/renderer/src/lib/results'
import { useResultsView } from '../src/renderer/src/stores/results-view'
import { useRun } from '../src/renderer/src/stores/run'
import { validRun } from './fixtures/valid-run'
import type { Cause, StudentResult } from '../src/shared/artifact'
import { toCsv } from '../src/renderer/src/lib/export'
import { SCALES } from '../src/renderer/src/lib/scale'

function connected(): StudentResult {
  const student = validRun().students[0]
  student.checks[0].execution = { ...student.checks[0].execution!, transport: 'ssh',
    command_attempts: 1, connect_attempts: 1, address: '192.0.2.10', user: 'ficticio', host: 'server' }
  return student
}

beforeEach(() => useResultsView.getState().reset())

describe('evidence of an SSH connection', () => {
  const causes: Cause[] = ['NONE', 'CONNECT_FAILED', 'AUTH_FAILED', 'TIMEOUT',
    'CONNECTION_LOST', 'NOT_RUN', 'CANCELLED', 'OUTPUT_OVERFLOW', 'ENGINE_ERROR']

  it.each(causes)('uses execution evidence rather than the final cause: %s', (cause) => {
    const student = connected()
    student.checks[0].cause = cause
    if (cause !== 'NONE') {
      student.checks[0].status = 'UNEVALUATED'
      student.status = 'NOT_EVALUATED'
      student.checks[0].execution!.completed = false
    }
    // Includes sudo refusal after SSH authenticated, timeouts and lost sessions.
    expect(hasSSHConnection(student)).toBe(true)
    student.checks[0].execution = null
    expect(hasSSHConnection(student)).toBe(false)
  })

  it('does not mistake an inventory grade, connection attempts or previous results for SSH evidence', () => {
    const student = validRun().students[0]
    expect(hasSSHConnection(student)).toBe(false)
    student.checks[0].execution!.transport = 'ssh'
    student.checks[0].execution!.connect_attempts = 3
    expect(hasSSHConnection(student)).toBe(false)
    student.checks[0].execution = null
    student.checks[0].previous = { run_id: 'older', status: 'PASS', cause: 'NONE', finished_at: student.finished_at }
    expect(hasSSHConnection(student)).toBe(false)
  })

  it('includes evidence from any one host and excludes an excluded student', () => {
    const student = connected()
    student.checks.unshift({ ...student.checks[0], execution: null, cause: 'CONNECT_FAILED' })
    expect(hasSSHConnection(student)).toBe(true)
    student.status = 'EXCLUDED'
    expect(hasSSHConnection(student)).toBe(false)
  })

  it('intersects hiding, student and check filters without modifying grades or exports', () => {
    const run = validRun()
    const first = connected()
    const second = connected()
    second.student_id = 'second'
    second.name = 'Otro alumno'
    second.checks[0].status = 'FAIL'
    second.checks[0].assertion!.matched = false
    second.score = { ...second.score, obtained: 0, final_score: 0, provisional_score: 0 }
    run.students = [first, second, { ...validRun().students[0], student_id: 'inventory' }]
    const original = JSON.stringify(run)
    const csv = toCsv(run, SCALES.ten)
    expect(exploreResults(filterRun(run, NO_FILTERS), 'evaluated', 'name', 50)).toHaveLength(2)
    const rows = exploreResults(filterRun(run, { ...NO_FILTERS, status: 'FAIL' }), 'evaluated', 'name', 50, [first.student_id])
    expect(rows.map(({ student }) => student.student_id)).toEqual(['second'])
    expect(exploreResults(filterRun(run, NO_FILTERS), 'all', 'name', 50, run.students.map((s) => s.student_id))).toEqual([])
    expect(JSON.stringify(run)).toBe(original)
    expect(toCsv(run, SCALES.ten)).toBe(csv)
  })
})

describe('session presentation state', () => {
  it('preserves hiding and exploration over new runs, retries and source edits from the same sources', () => {
    const run = validRun()
    useRun.getState().setArtifact(run, '/tmp/ficticio-1.json')
    const view = useResultsView.getState()
    view.hideStudent('fake')
    view.hideStudent('fake')
    view.setFilters({ ...NO_FILTERS, text: 'Ficticio' })
    view.setStudentFilter('evaluated')
    view.setOrder('grade-desc')
    view.setMode('matrix')
    useRun.getState().begin()
    useRun.getState().setArtifact({ ...run, run_id: 'R2', inventory: { ...run.inventory, sha256: 'changed' } }, '/tmp/ficticio-2.json')
    expect(useResultsView.getState()).toMatchObject({ hiddenIds: ['fake'], order: 'grade-desc', mode: 'matrix',
      studentFilter: 'evaluated', filters: { ...NO_FILTERS, text: 'Ficticio' } })
  })

  it.each(['exam', 'inventory'] as const)('resets when opening history from another %s source', (source) => {
    const run = validRun()
    useRun.getState().setArtifact(run, '/tmp/ficticio.json')
    useResultsView.getState().hideStudent('fake')
    useResultsView.getState().setOrder('failures')
    useRun.getState().setArtifact({ ...run, [source]: { ...run[source], path: '/another/source.yaml' } }, '/tmp/other.json')
    expect(useResultsView.getState()).toMatchObject({ hiddenIds: [], order: 'name', studentFilter: 'all' })
  })

  it('resets filters without restoring hidden students; restores one or all explicitly', () => {
    const view = useResultsView.getState()
    view.hideStudent('a')
    view.hideStudent('b')
    view.setStudentFilter('evaluated')
    view.setOrder('failures')
    view.clearFilters()
    expect(useResultsView.getState()).toMatchObject({ hiddenIds: ['a', 'b'], studentFilter: 'all', order: 'name', filters: NO_FILTERS })
    view.showStudent('a')
    expect(useResultsView.getState().hiddenIds).toEqual(['b'])
    view.showAll()
    expect(useResultsView.getState().hiddenIds).toEqual([])
    view.hideStudent('a')
    view.reset()
    expect(useResultsView.getState()).toMatchObject({ hiddenIds: [], scope: null })
  })

  it('preserves state on navigation/projector and clears it only on actual class or exam changes', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() })
    const { useApp } = await import('../src/renderer/src/stores/app')
    const project = { dir: '/tmp/ficticio', name: 'Ficticio', examPath: '/tmp/ficticio/examen.yaml' }
    useApp.getState().setProject(project)
    useApp.getState().setClassId('a')
    useResultsView.getState().hideStudent('fake')
    useApp.getState().setView('results')
    useApp.getState().toggleProjector()
    useApp.getState().toggleProjector()
    useApp.getState().setView('correct')
    useApp.getState().setClassId('a')
    useApp.getState().setProject({ ...project, name: 'Renamed' })
    expect(useResultsView.getState().hiddenIds).toEqual(['fake'])
    useApp.getState().setClassId('b')
    expect(useResultsView.getState().hiddenIds).toEqual([])
    useResultsView.getState().hideStudent('fake')
    useApp.getState().setProject({ ...project, examPath: '/tmp/ficticio/otro.yaml' })
    expect(useResultsView.getState().hiddenIds).toEqual([])
    useResultsView.getState().hideStudent('fake')
    useApp.getState().setProject(null)
    expect(useResultsView.getState().hiddenIds).toEqual([])
    vi.unstubAllGlobals()
  })

  it('does not clear state for a project change still awaiting unsaved-editor resolution', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null })
    const { useApp } = await import('../src/renderer/src/stores/app')
    useResultsView.getState().hideStudent('fake')
    useApp.getState().setEditorDraft({ path: 'exam', text: 'changed', savedText: 'original' })
    useApp.getState().setProject({ dir: '/tmp/another', name: 'Other', examPath: '/tmp/another/examen.yaml' })
    expect(useResultsView.getState().hiddenIds).toEqual(['fake'])
    useApp.getState().resolveNavigation(false)
    expect(useResultsView.getState().hiddenIds).toEqual(['fake'])
    useApp.getState().setEditorDraft(null)
    vi.unstubAllGlobals()
  })
})
