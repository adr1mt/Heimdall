import { useState } from 'react'
import { Button, ConfirmDialog, Spinner, ViewHeader } from '@/components/ui'
import { useApp, useScale, noticeFrom } from '@/stores/app'
import { useExamRecord } from '@/stores/exam-record'
import { useRun } from '@/stores/run'
import { scoreView } from '@/lib/results'
import { pauseExam, resumeExam, prepareAnotherExam } from '@/lib/exam-actions'
import { savedExamCsv, savedExamCsvName, savedExamRows } from '@/lib/export'
import { MoodleExportButton } from './MoodleExport'
import { ReportAccessHelp } from './ReportAccessHelp'
import type { SavedExam } from '../../../shared/exam-record'

export function FinishExamButton() {
  const active = useApp(s => s.exam.active)
  const { saved, finishing, changing } = useExamRecord()
  if (!active && !finishing && !['PAUSED', 'FINALIZING', 'ACTIVE'].includes(saved?.record.state ?? '')) return null
  async function finish() {
    if (useExamRecord.getState().finishing) return
    const { project, classId } = useApp.getState()
    if (!project || !classId) return
    useExamRecord.setState({ finishing: true })
    useApp.getState().stopExam()
    try {
      const saved = await window.heimdall.finishExam(project.examPath, classId, useApp.getState().passMark, useExamRecord.getState().saved?.record.id)
      if (useApp.getState().project?.examPath !== project.examPath || useApp.getState().classId !== classId) return
      useExamRecord.getState().accept(saved)
      useExamRecord.setState({ showFinals: true, prompt: false })
      useApp.setState({ examRounds: saved.record.rounds.map(r => r.path) })
      useApp.getState().setView('results')
    } catch (error) { useApp.getState().setNotice(noticeFrom('No se pudo finalizar el examen', error)) }
    finally { useExamRecord.setState({ finishing: false }) }
  }
  return <Button size="sm" disabled={finishing || changing} onClick={() => void finish()}>
    {finishing && <Spinner />}{finishing ? 'Finalizando… espera a la corrección en curso' : 'Finalizar examen'}
  </Button>
}

export function ExamSessionActions({ placement = 'all' }: { placement?: 'all' | 'session' }) {
  const { saved, problem, finishing, changing } = useExamRecord()
  const active = useApp(s => s.exam.active)
  const busy = useRun(s => s.phase === 'running' || s.phase === 'starting')
  const [open, setOpen] = useState(false)
  return <>
    {active && <Button size="sm" variant="outline" disabled={finishing} onClick={() => void pauseExam()}>Pausar</Button>}
    {!active && saved?.record.state === 'PAUSED' && <Button size="sm" variant="outline" disabled={busy || finishing || changing} onClick={() => void resumeExam(useApp.getState().exam.everyMinutes)}>Reanudar</Button>}
    <FinishExamButton />
    {placement !== 'session' && (saved?.record.state === 'FINALIZED'
      ? <Button size="sm" variant="outline" onClick={() => useExamRecord.setState({ showFinals: true })}>Notas finales</Button>
      : (saved || problem) && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Mejores notas</Button>)}
    <ConfirmDialog open={open} title="Mejores notas" cancelLabel="Cerrar" onCancel={() => setOpen(false)}>
      {problem && <p role="alert">{problem}</p>}
      {saved && <GradesTable saved={saved} />}
    </ConfirmDialog>
  </>
}

/** The only primary surface after closure: names, grades and report delivery. */
export function FinalGrades({ saved }: { saved: SavedExam }) {
  const [exporting, setExporting] = useState(false)
  const scale = useScale()
  return <div className="flex h-full flex-col" data-testid="final-grades">
    <ViewHeader title="Notas finales" actions={<>
      <Button size="sm" variant="outline" onClick={prepareAnotherExam}>Preparar otro examen</Button>
      <FinalReports />
      <Button size="sm" variant="outline" onClick={() => setExporting(true)}>Exportar notas</Button>
    </>} />
    <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-muted-foreground">{saved.record.title} · {saved.record.className} · Examen finalizado</p>
        <p className="text-sm text-muted-foreground">Las notas quedan guardadas en el histórico. Para cambiar de clase o empezar de nuevo, pulsa «Preparar otro examen».</p>
        <GradesTable saved={saved} />
      </div>
    </div>
    <ConfirmDialog open={exporting} title="Exportar notas" cancelLabel="Cerrar" onCancel={() => setExporting(false)}>
      <div className="flex flex-wrap gap-3">
        <Button size="sm" variant="outline" onClick={() => {
          void window.heimdall.saveCsv(savedExamCsvName(saved), savedExamCsv(saved, scale))
            .then(path => { if (path) useApp.getState().setNotice(`Notas exportadas: ${path}`, 'success') })
            .catch(error => useApp.getState().setNotice(noticeFrom('No se pudo exportar', error)))
        }}>CSV</Button>
        <MoodleExportButton rows={savedExamRows(saved, scale)} at={saved.record.closedAt || saved.record.createdAt} />
      </div>
    </ConfirmDialog>
  </div>
}

function GradesTable({ saved }: { saved: SavedExam }) {
  const scale = useScale()
  const students = saved.session?.students.map(student => ({ id: student.student_id, name: student.name,
    grade: student.from_round ? scoreView(student.score, { ...scale, passMark: saved.record.passMark }).text : 'Sin nota final' }))
    ?? saved.record.roster.map(student => ({ id: student.id, name: student.name, grade: 'Sin nota final' }))
  const delivered = Object.keys(saved.record.delivery).length > 0
  return <table className="w-full text-left text-base" aria-label={saved.record.state === 'FINALIZED' ? 'Notas finales' : 'Mejores notas'}>
    <thead><tr className="border-b border-border text-sm text-muted-foreground"><th scope="col" className="py-2 pr-4 font-medium">Alumno</th><th scope="col" className="py-2 text-right font-medium">Mejor nota</th>{delivered && <th scope="col" className="py-2 pl-6 font-medium">Informe</th>}</tr></thead>
    <tbody>{students.map(student => {
      const receipt = saved.record.delivery[student.id]
      return <tr key={student.id} className="border-b border-border">
        <th scope="row" className="py-2 pr-4 font-medium">{student.name}</th>
        <td className="py-2 text-right text-base font-semibold tabular-nums">{student.grade}</td>
        {delivered && <td className="py-2 pl-6 text-sm">
          {receipt?.state === 'SENT' ? 'Entregado' : receipt?.state === 'SENDING' ? 'Entrega pendiente de confirmar' : 'No entregado'}
          {receipt?.reason && <p className="max-w-md break-words text-xs text-muted-foreground">{receipt.reason}</p>}
        </td>}
      </tr>
    })}</tbody>
  </table>
}

/** Every send (including retries) has one explicit confirmation. */
function FinalReports() {
  const { saved, prompt } = useExamRecord()
  const scale = useScale()
  const [sending, setSending] = useState(false)
  if (!saved || saved.record.state !== 'FINALIZED') return null
  const pending = saved.session?.students.filter(s => s.from_round > 0 && saved.record.delivery[s.student_id]?.state !== 'SENT') ?? []
  const retrying = pending.some(s => !!saved.record.delivery[s.student_id])
  async function send() {
    if (sending || !saved) return
    useExamRecord.setState({ prompt: false })
    setSending(true)
    try {
      await window.heimdall.sendFinalReports(saved.record.examPath, saved.record.classId, saved.record.id, scale)
      if (useExamRecord.getState().saved?.record.id !== saved.record.id) return
      await useExamRecord.getState().load(saved.record.examPath, saved.record.classId, saved.record.id)
    } catch (error) { useApp.getState().setNotice(noticeFrom('No se pudieron enviar los informes finales', error)) }
    finally { setSending(false) }
  }
  return <>
    <Button size="sm" disabled={sending || !pending.length} onClick={() => useExamRecord.setState({ prompt: true })}>
      {sending ? 'Enviando informes…' : retrying ? 'Reintentar no entregados' : 'Enviar informes a todos'}
    </Button>
    <ConfirmDialog open={prompt} title={retrying ? 'Reintentar informes no entregados' : 'Enviar informes a todos'} confirmLabel="Enviar informes" cancelLabel="Cancelar"
      onConfirm={() => void send()} onCancel={() => useExamRecord.setState({ prompt: false })}>
      <p>¿Quieres entregar los informes definitivos? Cada alumno recibirá su mejor nota conseguida.</p>
      <ReportAccessHelp file={`informe-final-${saved.record.id}.html`} />
    </ConfirmDialog>
  </>
}
