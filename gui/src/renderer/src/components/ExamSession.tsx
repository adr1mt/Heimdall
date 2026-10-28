import { useEffect, useState } from 'react'
import { Button, ConfirmDialog, Spinner } from '@/components/ui'
import { useApp, useScale, noticeFrom } from '@/stores/app'
import { useExamRecord } from '@/stores/exam-record'
import { useRun } from '@/stores/run'
import { scoreView } from '@/lib/results'
import { savedExamCsv, savedExamCsvName, savedExamRows } from '@/lib/export'
import { MoodleExportButton } from './MoodleExport'
import { ReportAccessHelp } from './ReportAccessHelp'
import type { ExamRecord } from '../../../shared/exam-record'
import type { Delivery } from '../../../shared/types'

/** Available from both operational screens, with a single durable close action. */
export function FinishExamButton() {
  const active = useApp(s => s.exam.active)
  const saved = useExamRecord(s => s.saved)
  const finishing = useExamRecord(s => s.finishing)
  if (!active && !finishing && saved?.record.state !== 'FINALIZING') return null
  async function finish() {
    if (useExamRecord.getState().finishing) return
    const { project, classId } = useApp.getState()
    if (!project || !classId) return
    useExamRecord.setState({ finishing: true })
    useApp.getState().stopExam()
    try {
      const saved = await window.heimdall.finishExam(project.examPath, classId, useApp.getState().passMark)
      if (useApp.getState().project?.examPath !== project.examPath || useApp.getState().classId !== classId) return
      useExamRecord.getState().accept(saved)
      useExamRecord.setState({ prompt: true })
      useApp.setState({ examRounds: saved.record.rounds.map(r => r.path) })
      useApp.getState().setView('results')
    } catch (error) { useApp.getState().setNotice(noticeFrom('No se pudo finalizar el examen', error)) }
    finally { useExamRecord.setState({ finishing: false }) }
  }
  return <Button size="sm" disabled={finishing} onClick={() => void finish()}>
    {finishing && <Spinner />}{finishing ? 'Finalizando… espera a la corrección en curso' : 'Finalizar examen'}
  </Button>
}

export function ExamSessionActions() {
  const saved = useExamRecord(s => s.saved)
  const problem = useExamRecord(s => s.problem)
  const [open, setOpen] = useState(false)
  return <>
    <FinishExamButton />
    {(saved || problem) && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Mejores notas</Button>}
    <BestGrades open={open} onClose={() => setOpen(false)} />
  </>
}

function BestGrades({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { saved, problem } = useExamRecord()
  const scale = useScale()
  const [history, setHistory] = useState<ExamRecord[]>([])
  useEffect(() => {
    const { project, classId } = useApp.getState()
    if (!open || !project || !classId) return
    void window.heimdall.examRecords(project.examPath, classId).then(setHistory)
      .catch(error => useApp.getState().setNotice(noticeFrom('No se pudieron leer las sesiones', error)))
  }, [open, saved?.record.id])
  async function choose(id: string) {
    const { project, classId } = useApp.getState()
    if (!project || !classId) return
    try {
      const next = await useExamRecord.getState().load(project.examPath, classId, id)
      const last = next?.record.rounds.at(-1)
      if (last) useRun.getState().setArtifact(await window.heimdall.readArtifact(last.path), last.path)
    } catch (error) { useApp.getState().setNotice(noticeFrom('No se pudo abrir la sesión', error)) }
  }
  return <ConfirmDialog open={open} title="Mejores notas" cancelLabel="Cerrar" onCancel={onClose}>
    {problem && <p role="alert">{problem}</p>}
    {saved && <div className="space-y-3">
      {history.length > 1 && <label className="block">Sesión
        <select className="mt-1 w-full rounded border border-input bg-background p-2 text-foreground" value={saved.record.id}
          disabled={useApp.getState().exam.active || useExamRecord.getState().finishing}
          onChange={event => void choose(event.target.value)}>
          {history.map(record => <option key={record.id} value={record.id}>{new Date(record.createdAt).toLocaleString('es-ES')} · {record.state === 'FINALIZED' ? 'Finalizada' : 'En curso'}</option>)}
        </select>
      </label>}
      <p>{saved.record.title} · {saved.record.className}</p>
      <p>{saved.record.state === 'FINALIZED' ? 'Notas finales · Examen finalizado' : 'Mejor nota completa hasta ahora'}</p>
      <p className="text-xs">Las comprobaciones de la matriz corresponden a la última vuelta.</p>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-left text-sm"><thead><tr><th className="py-2">Alumno</th><th>Nota</th><th>Vuelta</th></tr></thead>
          <tbody>{saved.session?.students.map(student => <tr key={student.student_id} className="border-t border-border">
            <td className="py-2 pr-3">{student.name}{!student.from_round && <p className="text-xs">{student.reason || 'Ninguna vuelta con evaluación completa.'}</p>}</td>
            <td className="pr-3 tabular-nums">{student.from_round ? scoreView(student.score, scale).text : 'Sin nota final'}</td>
            <td className="tabular-nums">{student.from_round || '—'}</td>
          </tr>)}</tbody>
        </table>
        {!saved.session && <div className="py-3"><p>Sin nota final: no se ha completado ninguna vuelta de estos criterios.</p>{saved.record.roster.map(student => <p key={student.id} className="py-1">{student.name} · Sin nota final</p>)}</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => {
          void window.heimdall.saveCsv(savedExamCsvName(saved), savedExamCsv(saved, scale))
            .then(path => { if (path) useApp.getState().setNotice(`Notas exportadas: ${path}`, 'success') })
            .catch(error => useApp.getState().setNotice(noticeFrom('No se pudo exportar', error)))
        }}>Exportar {saved.record.state === 'FINALIZED' ? 'notas finales a CSV' : 'CSV'}</Button>
        <MoodleExportButton rows={savedExamRows(saved, scale)} at={saved.record.closedAt || saved.record.createdAt} />
      </div>
    </div>}
  </ConfirmDialog>
}

/** Mounted once in App so closing the exam never loses its one send question. */
export function FinalReports() {
  const { saved, prompt, finishing } = useExamRecord()
  const scale = useScale()
  const [sending, setSending] = useState(false)
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  useEffect(() => { setDelivery(null) }, [saved?.record.id])
  if (!saved || saved.record.state !== 'FINALIZED' || finishing) return null
  const eligible = new Set(saved.session?.students.filter(s => s.from_round > 0).map(s => s.student_id) ?? [])
  const ungradedCount = delivery?.students.filter(s => !eligible.has(s.student_id)).length ?? 0
  const failedCount = delivery?.students.filter(s => !s.delivered && eligible.has(s.student_id)).length ?? 0
  const pending = saved.session?.students.filter(s => s.from_round > 0 && saved.record.delivery[s.student_id]?.state !== 'SENT') ?? []
  async function send() {
    if (sending || !saved) return
    useExamRecord.setState({ prompt: false })
    setSending(true)
    try {
      const answer = await window.heimdall.sendFinalReports(saved.record.examPath, saved.record.classId, saved.record.id, scale)
      if (useExamRecord.getState().saved?.record.id !== saved.record.id) return
      setDelivery(answer)
      await useExamRecord.getState().load(saved.record.examPath, saved.record.classId, saved.record.id)
    } catch (error) { useApp.getState().setNotice(noticeFrom('No se pudieron enviar los informes finales', error)) }
    finally { setSending(false) }
  }
  return <>
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-sm">
      <strong>Examen finalizado</strong>
      {saved.record.closedAt && <span className="text-xs text-muted-foreground">{new Date(saved.record.closedAt).toLocaleString('es-ES')}</span>}
      <Button size="sm" variant="outline" disabled={sending || !pending.length} onClick={() => useExamRecord.setState({ prompt: true })}>
        {sending ? 'Enviando informes finales…' : pending.length ? 'Enviar informes finales' : 'Informes finales enviados'}
      </Button>
      {saved.record.roster.length > (saved.session?.students.filter(s => s.from_round > 0).length ?? 0) && <span className="text-xs">{saved.record.roster.length - (saved.session?.students.filter(s => s.from_round > 0).length ?? 0)} sin nota final</span>}
      {!saved.session && <span>Sin nota final: no hubo una vuelta completa.</span>}
      {Object.values(saved.record.delivery).some(receipt => receipt.state !== 'SENT') && <details className="w-full text-xs"><summary>Informes pendientes o fallidos</summary>{Object.entries(saved.record.delivery).filter(([, receipt]) => receipt.state !== 'SENT').map(([id, receipt]) => <p key={id}>{saved.record.roster.find(s => s.id === id)?.name || id}: {receipt.reason || 'Entrega interrumpida; puedes reintentar sin sobrescribir el informe.'}</p>)}</details>}
    </div>
    <ConfirmDialog open={prompt} title="Examen finalizado." confirmLabel={pending.length ? 'Enviar informes' : undefined} cancelLabel="Ahora no"
      onConfirm={pending.length ? () => void send() : undefined} onCancel={() => useExamRecord.setState({ prompt: false })}>
      <p>{pending.length ? `¿Quieres enviar los informes definitivos a los ${pending.length} alumnos?` : 'No quedan informes con nota final pendientes de enviar.'}</p>
      <p>Cada alumno recibirá su mejor nota y las comprobaciones de la vuelta en que la consiguió.</p>
      <ReportAccessHelp file={`informe-final-${saved.record.id}.html`} />
    </ConfirmDialog>
    <ConfirmDialog open={delivery !== null} title={delivery ? `${delivery.students.filter(s => s.delivered).length} informes enviados · ${failedCount} pendientes${ungradedCount ? ` · ${ungradedCount} sin nota final` : ''}` : ''}
      cancelLabel="Cerrar" confirmLabel={pending.length ? 'Reintentar pendientes o fallidos' : undefined}
      onConfirm={pending.length ? () => { setDelivery(null); void send() } : undefined} onCancel={() => setDelivery(null)}>
      <div className="max-h-80 space-y-2 overflow-auto">{delivery?.students.map(student => <p key={student.student_id}>{student.name} · {student.delivered ? 'Enviado' : !eligible.has(student.student_id) ? `Sin nota final: ${student.reason || 'ninguna vuelta completa'}` : student.reason}</p>)}</div>
      <ReportAccessHelp file={delivery?.file} />
    </ConfirmDialog>
  </>
}
