import { Button, SectionTitle, ViewHeader } from '@/components/ui'
import { useApp, useScale } from '@/stores/app'
import { useRun } from '@/stores/run'
import { attentionStudents, gradeHistogram, failingChecks, successByGroup } from '@/lib/analytics'
import { averageText, classSummary, displayedAverage } from '@/lib/summary'
import { gradeAppearance } from '@/lib/grade-appearance'
import { CAUSE_TEXT, scoreView, tally } from '@/lib/results'

export default function AnalyticsView() {
  const artifact = useRun((s) => s.artifact)
  const scale = useScale()
  const setView = useApp((s) => s.setView)
  if (!artifact)
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Analíticas" />
        <div className="p-6 text-sm text-muted-foreground">
          Abre una corrección en Resultados para ver sus analíticas.
        </div>
      </div>
    )
  const summary = classSummary(artifact, scale.passMark)
  const attention = attentionStudents(artifact, scale.passMark)
  const failing = failingChecks(artifact)
    .filter((check) => check.failed > 0)
    .slice(0, 8)
  const groups = successByGroup(artifact)
  const { bins, ungraded } = gradeHistogram(artifact, scale.passMark)
  const maxBin = Math.max(1, ...bins.map((bin) => bin.failed + bin.passed))
  const maxFail = Math.max(1, ...failing.map((check) => check.failed))
  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Analíticas"
        meta={
          <span className="text-xs text-muted-foreground">
            {summary.students} alumnos · media{' '}
            {averageText(displayedAverage(artifact, scale))} · {summary.passed}{' '}
            aprobados
          </span>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="max-w-5xl space-y-7">
          <section>
            <SectionTitle hint="Primero los problemas técnicos; después, las notas por debajo del aprobado.">
              Atención prioritaria{' '}
              <span className="ml-2 text-muted-foreground">{attention.length}</span>
            </SectionTitle>
            {attention.length === 0 ? (
              <p className="text-sm text-success-strong">
                Nadie requiere atención en esta corrección.
              </p>
            ) : (
              <table className="w-full max-w-3xl text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 font-normal">Alumno</th>
                    <th className="font-normal">Nota</th>
                    <th className="font-normal">Objetivos</th>
                    <th className="font-normal">Atención</th>
                  </tr>
                </thead>
                <tbody>
                  {attention.slice(0, 5).map((student) => {
                    const counts = tally(student.checks)
                    const cause = student.checks.find((check) => check.cause !== 'NONE')?.cause
                    const score = scoreView(student.score, scale)
                    return (
                      <tr key={student.student_id} className="border-b border-border/50">
                        <td className="py-2">{student.name}</td>
                        <td className={gradeAppearance(student, scale.passMark).color}>
                          {score.value === null ? '—' : score.text}
                          {score.kind === 'provisional' && (
                            <span className="block text-micro">provisional</span>
                          )}
                        </td>
                        <td>
                          {counts.fail}/{student.checks.length} fallados
                          {counts.unevaluated > 0 && (
                            <span className="block text-warning-strong">
                              {counts.unevaluated} sin evaluar
                            </span>
                          )}
                        </td>
                        <td className={cause ? 'text-warning-strong' : 'text-muted-foreground'}>
                          {cause ? CAUSE_TEXT[cause] : 'Por debajo del aprobado'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 px-0 text-primary"
              onClick={() => setView('results')}
            >
              Ver la lista completa en Resultados →
            </Button>
          </section>
          <section>
            <SectionTitle hint="Número de alumnos que no superan cada comprobación.">
              Objetivos fallados con más frecuencia
            </SectionTitle>
            {failing.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay fallos académicos en lo evaluado.
              </p>
            ) : (
              <div className="max-w-3xl space-y-2">
                {failing.map((check) => (
                  <div
                    key={check.checkId}
                    className="grid grid-cols-[minmax(120px,1fr)_2fr_2rem] items-center gap-3 text-xs"
                  >
                    <span className="text-right" title={check.description}>
                      {check.description}
                    </span>
                    <div className="h-5">
                      <div
                        className="h-full rounded-r bg-destructive"
                        style={{ width: `${(check.failed / maxFail) * 100}%` }}
                      />
                    </div>
                    <strong className="text-destructive-strong">{check.failed}×</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className="grid gap-8 lg:grid-cols-2">
            <section>
              <SectionTitle hint={`Aprobado a partir de ${scale.passMark} puntos de 100.`}>
                Distribución de notas
              </SectionTitle>
              <div className="relative pt-5">
                <div
                  className="pointer-events-none absolute bottom-5 top-0 z-10 border-l border-dashed border-warning-strong"
                  style={{ left: `${scale.passMark}%` }}
                >
                  <span className="absolute -top-1 -translate-x-1/2 whitespace-nowrap bg-background px-1 text-micro text-warning-strong">
                    aprobado ≥ {scale.passMark}
                  </span>
                </div>
                <div className="grid grid-cols-10 items-end gap-2">
                  {bins.map((bin) => (
                    <div
                      key={bin.from}
                      className="text-center text-xs"
                      aria-label={`${bin.from} a ${bin.from === 90 ? 100 : bin.from + 9} puntos: ${bin.passed} aprobados y ${bin.failed} suspensos`}
                    >
                      <div className="flex h-36 flex-col justify-end">
                        <span className="mb-1 text-muted-foreground">
                          {bin.failed + bin.passed || ''}
                        </span>
                        <div
                          className="bg-success"
                          style={{ height: `${(bin.passed / maxBin) * 110}px` }}
                        />
                        <div
                          className="bg-destructive"
                          style={{ height: `${(bin.failed / maxBin) * 110}px` }}
                        />
                      </div>
                      <span className="mt-1 block border-t border-border pt-1 text-muted-foreground">
                        {bin.from}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-micro text-muted-foreground">
                Puntos del motor · último intervalo: 90–100
              </p>
              {ungraded > 0 && (
                <p className="mt-2 text-xs text-warning-strong">
                  {ungraded} sin nota final, fuera de la distribución.
                </p>
              )}
            </section>
            <section>
              <SectionTitle hint="Comprobaciones superadas entre las evaluadas de cada grupo.">
                Tasa de éxito por grupo
              </SectionTitle>
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.group}>
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span>{group.group}</span>
                      <strong>{group.rate === null ? 'Sin evaluar' : `${group.rate}%`}</strong>
                    </div>
                    <div className="h-5 bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${group.rate ?? 0}%` }} />
                    </div>
                    {group.unevaluated > 0 && (
                      <span className="text-micro text-warning-strong">
                        {group.unevaluated} sin evaluar
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
