import { useEffect, useState } from 'react'
import { useRun } from '@/stores/run'
import { useApp } from '@/stores/app'
import { useExamRecord } from '@/stores/exam-record'
import { secondsLeft } from '@/lib/exam'

/** One small ticker: refreshing the clock never rerenders the results table. */
export function CorrectionClock() {
  const [now, setNow] = useState(Date.now)
  const exam = useApp((s) => s.exam)
  const phase = useRun((s) => s.phase)
  const last = useRun((s) => s.artifact?.finished_at)
  const problem = useRun((s) => s.artifactProblem || s.problem)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const record = useExamRecord(s => s.saved?.record)
  const finishing = useExamRecord(s => s.finishing)
  const remaining = secondsLeft(exam, now)
  const working = phase === 'starting' || phase === 'running'
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-b border-border px-4 py-1 text-xs text-muted-foreground tnum" aria-label="Tiempos de corrección">
      <time aria-label="Hora actual">{new Date(now).toLocaleTimeString('es-ES')}</time>
      <span role="status">{finishing ? 'Finalizando: espera a que termine la corrección en curso' : record?.state === 'FINALIZED' ? 'Examen finalizado' : working ? 'Corrigiendo… · resultados anteriores visibles, pendientes de actualizar' : 'En espera'}</span>
      {remaining !== null && !working && !finishing && record?.state !== 'FINALIZED' && <span>Próxima corrección en {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
      {last && <span>Última completada: <time dateTime={last}>{new Date(last).toLocaleTimeString('es-ES')}</time></span>}
      {problem && <span role="status" className="text-warning-strong">No se actualizó la corrección. Se conservan los resultados anteriores. {useApp.getState().projector ? 'Revisa Corregir al salir del proyector.' : problem}</span>}
    </div>
  )
}
