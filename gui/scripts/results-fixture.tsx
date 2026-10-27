// Isolated visual fixture. All names and results are fictitious; no IPC or disk writes.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import ResultsView from '../src/renderer/src/routes/Results'
import { useRun } from '../src/renderer/src/stores/run'
import { useReportDelivery } from '../src/renderer/src/stores/report-delivery'
import { useApp } from '../src/renderer/src/stores/app'
import { validRun } from '../tests/fixtures/valid-run'

declare global {
  interface Window {
    resultsFixture: (count: number, incomplete?: boolean) => void
    resultsProjector: (on: boolean) => void
    resultsRemount: () => void
    resultsConnections: () => void
    resultsRefresh: (kind: string) => void
    resultsDeliveryCalls: string[][]
  }
}
window.resultsDeliveryCalls = []
window.heimdall = { readExam: async () => null,
  sendReports: async (_path: string, file: string, reports: Record<string, string>) => {
    window.resultsDeliveryCalls.push(Object.keys(reports))
    return { file, students: Object.keys(reports).map((id) => ({ student_id: id, name: id, delivered: true })) }
  }
} as unknown as typeof window.heimdall
window.resultsRefresh = (kind) => {
  const state = useRun.getState()
  if (kind === 'begin') {
    useApp.setState({ exam: { active: true, nextAt: null, everyMinutes: 5, passes: 1 } })
    state.begin()
  } else if (kind === 'fail') {
    state.fail('Fallo ficticio de conexión')
    useApp.setState({ exam: { active: true, nextAt: Date.now() + 300000, everyMinutes: 5, passes: 1 } })
  } else {
    state.setArtifact({ ...state.artifact!, run_id: 'updated', finished_at: new Date().toISOString() }, '/tmp/updated.json')
    useRun.setState({ phase: 'finished', problem: null })
  }
}
window.resultsFixture = (count, incomplete = false) => {
  useReportDelivery.setState({ receipts: {}, sending: false })
  const run = validRun()
  run.run_id = `fixture-${count}-${incomplete}`
  run.plan = { ...run.plan, check_count: 50, total_weight: 50,
    check_ids: Array.from({ length: 50 }, (_, i) => `c${i}`) }
  run.students = Array.from({ length: count }, (_, i) => {
    const base = validRun().students[0]
    const passed = [50, 40, 30, 20, 10][i % 5]
    const missing = incomplete && i === count - 1
    return { ...base, student_id: `demo-${i}`, name: i === 1
      ? 'Bruno Demo con un nombre y dos apellidos muy largos'
      : `${['Ana', 'Bruno', 'Carla', 'Diego', 'Elena'][i % 5]} Demo ${i + 1}`,
      status: missing ? 'NOT_EVALUATED' : 'OK',
      score: { ...base.score, obtained: missing ? 0 : passed, evaluable: missing ? 0 : 50,
        total: 50, unevaluated: missing ? 50 : 0, status: missing ? 'NOT_EVALUATED' : 'COMPLETE',
        final_score: missing ? null : passed * 2, provisional_score: missing ? null : passed * 2 },
      checks: run.plan.check_ids.map((id, j) => ({ ...base.checks[0], check_id: id,
        description: j === 0 ? 'Comprobar que el servidor DHCP tiene configurado el rango de direcciones y las reservas de la práctica' : `Comprobación de redes ${j + 1}`,
        status: missing ? 'UNEVALUATED' : j < passed ? 'PASS' : 'FAIL',
        cause: missing ? 'CONNECT_FAILED' : 'NONE',
        execution: missing ? null : { ...base.checks[0].execution!, transport: 'ssh',
          address: '192.0.2.10', user: 'ficticio', host: 'servidor.aula', command: ['hostname'],
          command_attempts: 1, connect_attempts: 1 },
        assertion: missing ? null : { ...base.checks[0].assertion!, matched: j < passed } })) }
  })
  if (useApp.getState().projector) useApp.getState().toggleProjector()
  useApp.setState({ scale: 'ten', passMark: 70 })
  useRun.getState().setArtifact(run, '/tmp/ficticio.json')
}
window.resultsProjector = (on) => {
  if (useApp.getState().projector !== on) useApp.getState().toggleProjector()
}
window.resultsRemount = () => {
  flushSync(() => root.render(null))
  flushSync(() => root.render(<ResultsView />))
}
window.resultsConnections = () => {
  window.resultsFixture(5, true)
  const run = structuredClone(useRun.getState().artifact!)
  run.run_id = 'fixture-connections'
  run.status = 'PARTIAL'
  // One partial evaluation, one connected machine with only timeouts,
  // one SSH authentication refusal and one unreachable machine.
  const partial = run.students[1]
  partial.status = 'PARTIAL'
  partial.score = { ...partial.score, evaluable: 49, unevaluated: 1, final_score: null,
    provisional_score: Math.round(100 * partial.score.obtained / 49), status: 'INCOMPLETE' }
  partial.checks[49] = { ...partial.checks[49], status: 'UNEVALUATED', cause: 'TIMEOUT', assertion: null,
    execution: { ...partial.checks[49].execution!, completed: false, exit_code: null } }
  for (const [i, cause] of [[2, 'TIMEOUT'], [3, 'AUTH_FAILED']] as const) {
    const student = run.students[i]
    student.status = 'NOT_EVALUATED'
    student.score = { ...student.score, obtained: 0, evaluable: 0, unevaluated: 50,
      final_score: null, provisional_score: null, status: 'NOT_EVALUATED' }
    student.checks = student.checks.map((check) => ({ ...check, status: 'UNEVALUATED', cause, assertion: null,
      execution: i === 2 ? { ...check.execution!, completed: false, exit_code: null } : null }))
  }
  useRun.getState().setArtifact(run, '/tmp/ficticio-connections.json')
}
window.resultsFixture(5)
const root = createRoot(document.getElementById('root')!)
root.render(<ResultsView />)
