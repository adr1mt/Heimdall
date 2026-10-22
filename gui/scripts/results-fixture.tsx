// Isolated visual fixture. All names and results are fictitious; no IPC or disk writes.
import React from 'react'
import { createRoot } from 'react-dom/client'
import ResultsView from '../src/renderer/src/routes/Results'
import { useRun } from '../src/renderer/src/stores/run'
import { useApp } from '../src/renderer/src/stores/app'
import { validRun } from '../tests/fixtures/valid-run'

declare global {
  interface Window { resultsFixture: (count: number, incomplete?: boolean) => void }
}
window.resultsFixture = (count, incomplete = false) => {
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
        description: j === 0 ? 'Puerto SSH' : `Comprobación de redes ${j + 1}`,
        status: missing ? 'UNEVALUATED' : j < passed ? 'PASS' : 'FAIL',
        cause: missing ? 'CONNECT_FAILED' : 'NONE' })) }
  })
  useApp.setState({ scale: 'ten', passMark: 70, projector: false })
  useRun.getState().setArtifact(run, '/tmp/ficticio.json')
}
window.resultsFixture(5)
createRoot(document.getElementById('root')!).render(<ResultsView />)
