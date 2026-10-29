// Fictitious classroom only; no real IPC, credentials or records.
import './density-fixture'
import { useApp } from '../src/renderer/src/stores/app'
import { useExamRecord } from '../src/renderer/src/stores/exam-record'
import { useRun } from '../src/renderer/src/stores/run'
Object.assign(window.heimdall, { savedExam: async () => null, setExamMode: async () => undefined })
Object.assign(window, {
  classroomFinal: () => {
    useRun.setState({ phase: 'finished' })
    useApp.getState().stopExam()
    useExamRecord.getState().accept({ record: {
      version: 1, id: 'closed-demo', examPath: '/tmp/ficticio/examen.yaml', classId: 'demo',
      className: 'Clase demo', title: 'Examen ficticio', createdAt: '', state: 'FINALIZED',
      passMark: 70, examHash: '', inventoryHash: '', inventoryName: '', rounds: [], delivery: {},
      roster: useRun.getState().artifact!.students.map(student => ({ id: student.student_id, name: student.name, moodleId: '' }))
    }, session: null })
    useApp.getState().setView('results')
  }
})
