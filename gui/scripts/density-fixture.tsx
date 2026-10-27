// Isolated app shell and routes. Fictitious roster only; no real IPC, SSH or files.
import React from 'react'
import App from '../src/renderer/src/App'
import { root } from './results-fixture'
import { useApp } from '../src/renderer/src/stores/app'
import { useRun } from '../src/renderer/src/stores/run'
import { useClasses } from '../src/renderer/src/stores/classes'
import { emptyStudent } from '../src/shared/classes'
import { EXAM_OFF } from '../src/renderer/src/lib/exam'

declare global {
  interface Window {
    densityResults: (checks?: number) => void
    densityCorrect: (busy?: boolean) => void
  }
}
const noEvents = () => () => undefined
Object.assign(window.heimdall, {
  onUpdateReady: noEvents, onBackupWarning: noEvents, onRunEvent: noEvents, onRunClosed: noEvents,
  detectEngine: async () => ({ found: true, version: 'demo' }),
  describe: async () => ({ exam: { name: 'Servicios básicos · examen ficticio', checks: 4 } }),
  secretRefs: async () => []
})
useApp.setState({ project: { dir: '/tmp/ficticio', examPath: '/tmp/ficticio/examen.yaml', name: 'Examen ficticio' },
  theme: 'light', view: 'results', classId: 'demo' })
useApp.getState().setTheme('light')
window.densityResults = (checks = 4) => {
  window.resultsFixture(14, true)
  const artifact = structuredClone(useRun.getState().artifact!)
  artifact.plan.check_count = checks
  artifact.plan.total_weight = checks
  artifact.plan.check_ids = artifact.plan.check_ids.slice(0, checks)
  artifact.students = artifact.students.map((student, i) => {
    const missing = i >= 7
    return { ...student, status: missing ? 'NOT_EVALUATED' : 'OK',
      score: { ...student.score, obtained: missing ? 0 : checks, evaluable: missing ? 0 : checks,
        total: checks, unevaluated: missing ? checks : 0, status: missing ? 'NOT_EVALUATED' : 'COMPLETE',
        final_score: missing ? null : 100, provisional_score: missing ? null : 100 },
      checks: student.checks.slice(0, checks).map((check) => ({ ...check, status: missing ? 'UNEVALUATED' : 'PASS',
        cause: missing ? 'CONNECT_FAILED' : 'NONE', execution: missing ? null : check.execution,
        assertion: missing ? null : { ...check.assertion!, matched: true } })) }
  })
  useRun.getState().setArtifact(artifact, '/tmp/ficticio.json')
  useApp.setState({ view: 'results', exam: EXAM_OFF })
}
window.densityCorrect = (busy = false) => {
  const students = useRun.getState().artifact!.students
  useClasses.setState({ loaded: true, groups: [{ id: 'demo', name: 'Clase demo', columns: [], password: '',
    students: students.map((student) => ({ ...emptyStudent(), id: student.student_id, name: student.name })) }] })
  useRun.setState({ phase: busy ? 'running' : 'idle',
    students: busy ? students.map((student, i) => ({ studentId: student.student_id, name: student.name,
      done: i < 7 ? 4 : 0, pass: i < 7 ? 4 : 0, fail: 0, unevaluated: 0, excluded: false, status: null, score: null })) : [],
    start: null, done: busy ? 28 : 0, end: null })
  useApp.setState({ view: 'correct', exam: { ...EXAM_OFF, active: true, passes: 1 } })
}
window.densityResults()
root.render(<App />)
