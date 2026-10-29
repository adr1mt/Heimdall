import { useApp, noticeFrom } from '@/stores/app'
import { useExamRecord } from '@/stores/exam-record'
import { useResultsView } from '@/stores/results-view'
import { useRun } from '@/stores/run'

/** Pause only the scheduler; the active pass can finish or be stopped separately. */
export async function pauseExam(): Promise<void> {
  const app = useApp.getState()
  app.stopExam()
  try {
    await window.heimdall.setExamMode({ active: false })
    if (app.project && app.classId) await useExamRecord.getState().load(app.project.examPath, app.classId, useExamRecord.getState().saved?.record.id)
  } catch (error) { app.setNotice(noticeFrom('No se pudo guardar la pausa', error)) }
}

export async function resumeExam(minutes: number): Promise<void> {
  const app = useApp.getState(), store = useExamRecord.getState()
  if (!app.project || !app.classId || store.changing || store.finishing || ['starting', 'running'].includes(useRun.getState().phase)) return
  const pausedId = store.saved?.record.state === 'PAUSED' ? store.saved.record.id : null
  useExamRecord.setState({ changing: true })
  try {
    const group = (await window.heimdall.listClasses()).find(group => group.id === app.classId)
    if (!group) throw new Error('Selecciona una clase para continuar.')
    const refs = await window.heimdall.secretRefs(group.id)
    if (refs.length && !group.password) throw new Error('Guarda la contraseña de la clase antes de continuar.')
    await window.heimdall.setExamMode({ active: true, examPath: app.project.examPath, classId: group.id,
      recordId: pausedId ?? undefined,
      passMark: app.passMark, secrets: Object.fromEntries(refs.map(ref => [ref, group.password])) })
    const saved = await useExamRecord.getState().load(app.project.examPath, group.id)
    if (saved) {
      useExamRecord.getState().accept(saved)
      useApp.setState({ examRounds: saved.record.rounds.map(round => round.path) })
    }
    app.setRetry(null)
    useResultsView.getState().setMode('matrix')
    useApp.setState({ preparingExam: false })
    app.startExam(minutes, pausedId !== null && saved?.record.id === pausedId)
  } catch (error) {
    app.stopExam()
    try { await window.heimdall.setExamMode({ active: false }) }
    catch (pauseError) { app.setNotice(noticeFrom('No se pudo guardar la pausa', pauseError)); return }
    app.setNotice(noticeFrom('No se pudo reanudar el examen', error))
  }
  finally { useExamRecord.setState({ changing: false }) }
}

/** Clear presentation only after closure; the finalized record remains in history. */
export function prepareAnotherExam(): void {
  if (useExamRecord.getState().saved?.record.state !== 'FINALIZED' || useExamRecord.getState().changing ||
      useExamRecord.getState().finishing || ['starting', 'running'].includes(useRun.getState().phase)) return
  useApp.getState().stopExam()
  if (useApp.getState().projector) useApp.getState().toggleProjector()
  useApp.setState({ preparingExam: true, retry: null, examRounds: [] })
  useApp.getState().setClassId(null)
  useRun.getState().reset()
  useResultsView.getState().reset()
  useExamRecord.getState().reset()
  useApp.getState().setView('correct')
  useApp.getState().setNotice('Examen guardado en el histórico. Elige la clase para preparar el siguiente.', 'success')
}
