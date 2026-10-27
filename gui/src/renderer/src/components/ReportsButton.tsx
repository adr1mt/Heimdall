import { useEffect, useState } from 'react'
import { Check, Send } from 'lucide-react'
import { Button, ConfirmDialog, Spinner } from '@/components/ui'
import { useApp, useScale, noticeFrom } from '@/stores/app'
import { useRun } from '@/stores/run'
import { useReportDelivery } from '@/stores/report-delivery'
import { examTitleOf, reportFileName, reportsSummary, studentReport, studentReports } from '@/lib/report'
import { ReportAccessHelp } from './ReportAccessHelp'
import type { Delivery } from '../../../shared/types'
import { t } from '@/i18n/es'

interface Prepared {
  runId: string
  path: string
  file: string
  pages: Record<string, string>
  summary: string
}

/** Single and bulk sends share confirmation, generation, receipts and the IPC. */
export function ReportsButton({ artifactPath, studentId }: { artifactPath: string | null; studentId?: string }) {
  const artifact = useRun((s) => s.artifact)
  const phase = useRun((s) => s.phase)
  const project = useApp((s) => s.project)
  const scale = useScale()
  const { sending, receipts, send } = useReportDelivery()
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [delivery, setDelivery] = useState<(Delivery & { request: Prepared }) | null>(null)
  useEffect(() => { setPrepared(null); setDelivery(null) }, [artifact?.run_id])
  if (!artifact || !artifactPath) return null
  const student = studentId ? artifact.students.find((s) => s.student_id === studentId) : null
  if (student?.status === 'EXCLUDED') return null
  const alreadySent = studentId ? receipts[artifact.run_id]?.includes(studentId) : false
  const working = phase === 'starting' || phase === 'running'

  async function ask() {
    if (!artifact || !artifactPath || preparing || sending) return
    setPreparing(true)
    try {
      const yaml = project ? await window.heimdall.readExam(project.examPath).catch(() => null) : null
      const title = await examTitleOf(yaml, artifact.exam.sha256, project?.name ?? 'Examen')
      if (useRun.getState().artifact?.run_id !== artifact.run_id) return
      const pages = student ? { [student.student_id]: studentReport(artifact, student, scale, title) } : studentReports(artifact, scale, title)
      const sentCount = Object.keys(pages).filter((id) => receipts[artifact.run_id]?.includes(id)).length
      setPrepared({ runId: artifact.run_id, path: artifactPath, file: reportFileName(title), pages,
        summary: student ? `Destinatario: ${student.name} (${student.student_id}). Recibirá únicamente su informe de esta corrección.`
          : `${reportsSummary(artifact)}${sentCount ? `. ${sentCount} ya enviados: se volverán a enviar si confirmas.` : ''}` })
    } catch (error) { useApp.getState().setNotice(noticeFrom(t.reports.failed, error)) }
    finally { setPreparing(false) }
  }

  async function deliver(request: Prepared) {
    setPrepared(null)
    setDelivery(null)
    try { setDelivery({ ...await send(request.runId, request.path, request.file, request.pages, !!studentId), request }) }
    catch (error) { useApp.getState().setNotice(noticeFrom(t.reports.failed, error)) }
  }
  const sent = delivery?.students.filter((s) => s.delivered) ?? []
  const missing = delivery?.students.filter((s) => !s.delivered) ?? []
  return (
    <>
      <Button variant={studentId ? 'ghost' : 'outline'} size="sm"
        disabled={sending || preparing || working || alreadySent}
        aria-label={student ? (alreadySent ? `Informe enviado a ${student.name}` : `Enviar informe a ${student.name}`) : undefined}
        title={alreadySent ? 'Ya enviado para esta corrección. El envío general permite reenviarlo tras confirmarlo.' : undefined}
        onClick={() => void ask()}>
        {sending || preparing ? <Spinner /> : alreadySent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        {studentId ? (alreadySent ? 'Enviado' : 'Enviar informe') : sending ? t.reports.sending : t.reports.button}
      </Button>
      <ConfirmDialog open={prepared !== null} title={student ? '¿Enviar el informe a este alumno?' : t.reports.title}
        confirmLabel={t.reports.yes} onConfirm={() => { if (prepared) void deliver(prepared) }} onCancel={() => setPrepared(null)}>
        {prepared && <span className="block space-y-2">
          <span className="block">{prepared.summary}</span>
          <span className="block">{t.reports.where(prepared.file)}</span>
          <span className="block">El alumno puede copiar este HTML desde Ubuntu Desktop con Archivos, usando su conexión SSH.</span>
          <span className="block text-xs text-muted-foreground">{t.export.scale(scale.label)}</span>
        </span>}
      </ConfirmDialog>
      <ConfirmDialog open={delivery !== null} title={delivery ? t.reports.done(sent.length, delivery.students.length) : ''}
        cancelLabel={t.reports.close} confirmLabel={missing.length ? t.reports.retry : undefined}
        onConfirm={missing.length && delivery ? () => {
          // Retrying only the missing recipients avoids redelivering successes.
          if (!artifact || !artifactPath || delivery.request.runId !== artifact.run_id) return
          void askRetry()
        } : undefined} onCancel={() => setDelivery(null)}>
        <div className="max-h-80 space-y-3 overflow-auto">
          {missing.length > 0 && <div><p className="font-medium text-destructive-strong">{t.reports.missing}</p>
            {missing.map((s) => <p key={s.student_id}>{s.name} · {s.reason}</p>)}</div>}
          {sent.length > 0 && <div><p className="font-medium text-success-strong">{t.reports.arrived}</p><p>{sent.map((s) => s.name).join(' · ')}</p></div>}
          <ReportAccessHelp file={delivery?.file} />
        </div>
      </ConfirmDialog>
    </>
  )

  async function askRetry() {
    if (!delivery) return
    const pages = Object.fromEntries(missing.map((recipient) => [recipient.student_id, delivery.request.pages[recipient.student_id]]))
    await deliver({ ...delivery.request, pages })
  }
}
