import { useState } from 'react'
import type { ExamRecord, ReportExport } from '../../../shared/exam-record'
import { Button, ConfirmDialog } from '@/components/ui'
import { useApp, useScale, noticeFrom } from '@/stores/app'

export function ExportFinalReports({ record }: { record: ExamRecord }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [participants, setParticipants] = useState<{ id: string; name: string }[] | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReportExport | null>(null)
  const scale = useScale()
  const graded = new Set(record.finalOrigins?.filter(s => s.runId).map(s => s.studentId))
  const students = record.roster.filter(s => graded.has(s.id))
  const assigned = Object.values(mapping).filter(Boolean)

  async function act(work: () => Promise<void>) {
    setBusy(true)
    try { await work() }
    catch (error) { useApp.getState().setNotice(noticeFrom('Exportación de informes', error)) }
    finally { setBusy(false) }
  }
  async function save(assignments?: Record<string, string>) {
    const answer = await window.heimdall.exportFinalReports(record.examPath, record.classId, record.id, scale.id, assignments)
    if (answer) setResult(answer)
  }
  async function loadParticipants() {
    const options = await window.heimdall.moodleParticipants()
    if (!options) return
    setParticipants(options)
    const normalize = (name: string) => name.trim().toLocaleLowerCase()
    const matches = students.flatMap(s => {
      const name = normalize(s.name)
      const found = options.filter(p => normalize(p.name) === name)
      return found.length === 1 && students.filter(other => normalize(other.name) === name).length === 1
        ? [[s.id, found[0].id]] : []
    })
    setMapping(Object.fromEntries(matches))
  }
  return <>
    <Button size="sm" variant="outline" onClick={() => { setResult(null); setParticipants(null); setOpen(true) }}>Exportar informes…</Button>
    <ConfirmDialog open={open} title="Exportar informes" cancelLabel="Cerrar" onCancel={() => { if (!busy) setOpen(false) }}>
      {result ? <>
        <p role="status">{result.written} informes guardados.</p>
        <ul className="max-h-48 overflow-auto">{result.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
        {result.folder && <Button disabled={busy} onClick={() => void act(() => window.heimdall.openFolder(result.folder!))}>Abrir carpeta</Button>}
      </> : participants ? <>
        <p>Revisa cada destinatario de la tarea individual. Se incluirán {assigned.length} de {students.length} informes.</p>
        <div className="max-h-60 space-y-2 overflow-auto">{students.map(s => <label key={s.id} className="block">
          {s.name} ({s.id})
          <select className="block w-full border bg-background" disabled={busy} value={mapping[s.id] ?? ''}
            onChange={e => setMapping({ ...mapping, [s.id]: e.target.value })}>
            <option value="">Omitir este informe</option>
            {participants.map(p => <option key={p.id} value={p.id} disabled={assigned.includes(p.id) && mapping[s.id] !== p.id}>{p.name} · {p.id}</option>)}
          </select>
        </label>)}</div>
        <Button disabled={busy || !assigned.length} onClick={() => void act(() => save(Object.fromEntries(Object.entries(mapping).filter(([, id]) => id))))}>Crear ZIP de Moodle</Button>
      </> : <>
        <p>Guarda un HTML por alumno en tu ordenador, o prepara un ZIP para una tarea individual de Moodle con las carpetas de entrega descomprimidas.</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void act(() => save())}>Guardar en una carpeta…</Button>
          <Button variant="outline" disabled={busy || !students.length} onClick={() => void act(loadParticipants)}>Preparar para Moodle…</Button>
        </div>
      </>}
    </ConfirmDialog>
  </>
}
