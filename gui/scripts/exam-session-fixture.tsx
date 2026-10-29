// Synthetic visual fixture; no application profile, network or real student data.
import React from 'react'
import { createRoot } from 'react-dom/client'
import CorrectView from '../src/renderer/src/routes/Correct'
import { useClasses } from '../src/renderer/src/stores/classes'
import { emptyStudent } from '../src/shared/classes'
import ResultsView from '../src/renderer/src/routes/Results'
import HistoryView from '../src/renderer/src/routes/History'
import { useApp } from '../src/renderer/src/stores/app'
import { useRun } from '../src/renderer/src/stores/run'
import { useExamRecord } from '../src/renderer/src/stores/exam-record'
import { useResultsView } from '../src/renderer/src/stores/results-view'
import { validRun } from '../tests/fixtures/valid-run'
import type { SavedExam } from '../src/shared/exam-record'
const run = validRun(), base = run.students[0]
run.run_id = 'R2'; run.exam.path = '/tmp/fiction/examen.yaml'
run.plan = { ...run.plan, check_count: 19, total_weight: 19, check_ids: Array.from({ length: 19 }, (_, i) => `c${i}`) }
const names = ['Ana Ferrer', 'Biel Montserrat', 'Carla Gil', 'Diego Díaz', 'Elena Vera', 'Hugo Serra', 'Iván Roca', 'Javier Vidal', 'Kelvin Camp', 'Luis Soler', 'Marc Ariza', 'Nora Puig', 'Olga Rius', 'Pau Roig']
run.students = names.map((name, i) => ({ ...structuredClone(base), student_id: `s${i}`, name,
 score: { ...base.score, obtained: i === 13 ? 0 : 8, evaluable: i === 13 ? 0 : 12, unevaluated: i === 13 ? 12 : 0, total: 12, final_score: i === 13 ? null : 70, provisional_score: i === 13 ? null : 70, status: i === 13 ? 'NOT_EVALUATED' : 'COMPLETE' }, status: i === 13 ? 'NOT_EVALUATED' : 'OK',
 checks: run.plan.check_ids.map((id, c) => ({ ...structuredClone(base.checks[0]), check_id: id, description: `Comprobación de redes ${c + 1}`, status: i === 13 ? 'UNEVALUATED' : c < 8 ? 'PASS' : 'FAIL', cause: i === 13 ? 'CONNECT_FAILED' : 'NONE', execution: i === 13 ? null : base.checks[0].execution, assertion: i === 13 ? null : base.checks[0].assertion })) }))
let saved: SavedExam = { record: { version: 1, id: '00000000-0000-0000-0000-000000000001', examPath: run.exam.path, classId: 'fiction', className: 'Clase ficticia', title: 'Servicios de red · Datos ficticios', createdAt: '2026-10-28T10:00:00Z', state: 'ACTIVE', passMark: 70, examHash: run.exam.sha256, inventoryHash: run.inventory.sha256, inventoryName: 'aula-heimdall-fiction.yaml', roster: run.students.map(s => ({ id: s.student_id, name: s.name, moodleId: `${s.student_id}@example.invalid` })), rounds: [1, 2].map(round => ({ runId: `R${round}`, path: `/tmp/R${round}.json`, sha256: 'a'.repeat(64) })), delivery: {} },
 session: { session_version: 1, kind: 'session', plan_hash: run.plan_hash, plan: run.plan, rounds: [1, 2].map(round => ({ round, run_id: `R${round}`, artifact: `/tmp/R${round}.json`, started_at: run.started_at, finished_at: run.finished_at, status: 'PARTIAL' })), students: run.students.map((s, i) => ({ student_id: s.student_id, name: s.name, moodle_id: `${s.student_id}@example.invalid`, status: i === 13 ? 'ACTIVE' : 'FINISHED', from_round: i === 13 ? 0 : i % 2 + 1, from_run_id: i === 13 ? undefined : `R${i % 2 + 1}`, score: i === 13 ? s.score : { ...s.score, obtained: 12, evaluable: 12, total: 12, unevaluated: 0, status: 'COMPLETE', final_score: i === 1 ? 90 : 100, provisional_score: i === 1 ? 90 : 100 }, reason: i === 13 ? 'No hubo ninguna vuelta con evaluación completa: la máquina no respondió.' : undefined, rounds: [] })) } }
let calls = 0, sends = 0
let exported = ''
Object.assign(window, { examFixture: { get calls() { return calls }, get sends() { return sends }, get exported() { return exported }, history: () => useApp.getState().setView('history'), changeThreshold: () => useApp.setState({ passMark: 60 }), theme: (dark: boolean) => useApp.getState().setTheme(dark ? 'dark' : 'light'), projector: () => useApp.getState().toggleProjector(), correct: () => useApp.getState().setView('correct'), state: () => ({ active: useApp.getState().exam.active, minutes: useApp.getState().exam.everyMinutes }),
 idle: () => { useExamRecord.setState({ saved: null }); useApp.setState({ exam: { active: false, everyMinutes: 5, passes: 0, nextAt: null }, examRounds: [], view: 'correct' }); useRun.setState({ phase: 'idle', students: [], end: null }) },
 partial: () => { const partial = structuredClone(run); const student = partial.students[1]; student.status = 'PARTIAL'; student.score = { ...student.score, status: 'INCOMPLETE', final_score: null, provisional_score: 50, unevaluated: 1 }; useExamRecord.setState({ saved: null }); useRun.getState().setArtifact(partial, '/tmp/partial.json') },
 sessionError: () => { useApp.setState({ examRounds: ['/tmp/failed.json'], view: 'correct' }); window.heimdall.session = async () => { throw Error('Sesión ficticia no disponible') } }
 } })
const group = { id: 'fiction', name: 'Clase ficticia', password: '', columns: [], students: run.students.map(s => ({ ...emptyStudent(), id: s.student_id, name: s.name })) }
useClasses.setState({ groups: [group], loaded: true })
window.heimdall = { describe: async () => ({ exam: { name: 'Servicios de red · Datos ficticios', checks: 19 } }),
 session: async () => null, startRun: async () => undefined,
 readExam: async () => '', readArtifact: async () => structuredClone(run),
 listRuns: async () => saved.record.rounds.map(round => ({ path: round.path, at: run.finished_at })), listBackups: async () => [],
 listClasses: async () => [group], secretRefs: async () => [],
 setExamMode: async ({ active }: { active: boolean }) => { saved.record.state = active ? 'ACTIVE' : 'PAUSED' }, examRecords: async () => [saved.record], savedExam: async () => structuredClone(saved), saveCsv: async (_name: string, text: string) => { exported = text; return '/tmp/notas.csv' },
 finishExam: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 100)); saved = { ...saved, record: { ...saved.record, state: 'FINALIZED', closedAt: '2026-10-28T11:00:00Z' } }; return structuredClone(saved) },
 sendFinalReports: async () => {
   sends++
   for (const student of saved.session!.students.filter(s => s.from_round && saved.record.delivery[s.student_id]?.state !== 'SENT')) {
     saved.record.delivery[student.student_id] = student.student_id === 's0' && sends === 1
       ? { state: 'FAILED', at: saved.record.closedAt!, reason: 'Máquina apagada o sin conexión.' }
       : { state: 'SENT', at: saved.record.closedAt! }
   }
   return { file: `informe-final-${saved.record.id}.html`, students: saved.session!.students.map(s => ({ student_id: s.student_id, name: s.name, delivered: saved.record.delivery[s.student_id]?.state === 'SENT', reason: s.reason })) }
 }

} as unknown as typeof window.heimdall
useApp.setState({ engine: { found: true, path: '/tmp/fiction/heimdall', version: 'demo' }, project: { dir: '/tmp/fiction', examPath: run.exam.path, name: saved.record.title }, classId: 'fiction', view: 'results', exam: { active: true, everyMinutes: 5, passes: 2, nextAt: Date.now() + 300000 } })
useApp.getState().setTheme('light'); useRun.getState().setArtifact(run, '/tmp/R2.json'); useExamRecord.setState({ saved }); useResultsView.setState({ mode: 'matrix' })
function Harness() {
  const view = useApp(s => s.view)
  return view === 'history' ? <HistoryView /> : view === 'correct' ? <CorrectView /> : <ResultsView />
}
createRoot(document.getElementById('root')!).render(<Harness />)
