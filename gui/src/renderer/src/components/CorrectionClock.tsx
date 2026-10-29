import { useEffect, useState, type ReactNode } from 'react'
import { Clock3, LoaderCircle, Pause } from 'lucide-react'
import { useRun } from '@/stores/run'
import { useApp } from '@/stores/app'
import { useExamRecord } from '@/stores/exam-record'
import { secondsLeft } from '@/lib/exam'

/** One small ticker: refreshing the clock never rerenders the results table. */
export function CorrectionClock({ banner = false, actions }: { banner?: boolean; actions?: ReactNode }) {
  const [now, setNow] = useState(Date.now)
  const exam = useApp(s => s.exam)
  const phase = useRun(s => s.phase)
  const record = useExamRecord(s => s.saved?.record)
  const finishing = useExamRecord(s => s.finishing)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const remaining = secondsLeft(exam, now)
  const working = phase === 'starting' || phase === 'running'
  if (record?.state === 'FINALIZED' && !finishing) return null
  const paused = record?.state === 'PAUSED' && !working
  if (!finishing && !working && !paused && remaining === null) return null
  const text = finishing ? 'Finalizando…' : working ? 'Corrigiendo…' : paused ? 'Pausado'
    : `${Math.floor(remaining! / 60)}:${String(remaining! % 60).padStart(2, '0')}`
  const label = finishing ? 'Finalizando examen' : working ? 'Corrección en curso' : paused ? 'Examen pausado'
    : `Próxima corrección en ${text}`
  const Icon = finishing || working ? LoaderCircle : paused ? Pause : Clock3
  const timer = <div className="correction-timer" role="timer" aria-label={label} title={label}>
    <Icon className="h-4 w-4" aria-hidden="true" />
    <span className="tabular-nums">{text}</span>
  </div>
  const bannerLabel = exam.active || paused || finishing ? 'Modo examen' : 'Corrección'
  return banner ? <section className="exam-banner" aria-label={bannerLabel}>
    <span className="flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />{bannerLabel}</span>
    <div className="ml-auto">{timer}</div>
    {actions}
  </section> : timer
}

/** Exceptional failures stay visible; routine timing needs only the clock. */
export function CorrectionProblem() {
  const problem = useRun(s => s.artifactProblem || s.problem)
  const projector = useApp(s => s.projector)
  if (!problem) return null
  return <p role="status" className="shrink-0 border-b border-border px-4 py-2 text-xs text-warning-strong">
    No se actualizó la corrección. Se conservan los resultados anteriores. {projector ? 'Revisa Corregir al salir del proyector.' : problem}
  </p>
}
