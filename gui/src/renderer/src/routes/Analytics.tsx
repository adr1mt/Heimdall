import { Badge, Card, CardContent, SectionTitle, ViewHeader } from '@/components/ui'
import { useScale } from '@/stores/app'
import { toScale } from '@/lib/scale'
import { useRun } from '@/stores/run'
import {
  MOST_FAILED,
  distribution,
  failRate,
  failingChecks,
  successByGroup
} from '@/lib/analytics'
import { t } from '@/i18n/es'

/**
 * Analíticas: three readings and no more (T125) — which objectives the group
 * fails, how the grades fall, and how each part of the exam went.
 *
 * It reads the very artifact Resultados is showing, so the two screens cannot
 * disagree: no number here is computed from anything but the grades the
 * engine already published (principio 12).
 *
 * «Cómo va el grupo» and «A quién atender primero» are gone on purpose: the
 * first was this same distribution under a title that said nothing, and the
 * second was a list nobody read with the class in front of them.
 */
export default function AnalyticsView() {
  const artifact = useRun((s) => s.artifact)
  const scale = useScale()

  if (!artifact) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title={t.analytics.title} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
          <p className="text-sm">{t.analytics.none}</p>
          <p className="text-xs text-muted-foreground">{t.analytics.noneHint}</p>
        </div>
      </div>
    )
  }

  const { bands, ungraded } = distribution(artifact)
  const failing = failingChecks(artifact).slice(0, MOST_FAILED)
  const groups = successByGroup(artifact)
  const most = Math.max(1, ...bands.map((band) => band.students))

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t.analytics.title} />
      <div className="min-h-0 flex-1 space-y-6 overflow-auto p-6">
        <p className="max-w-3xl text-sm text-muted-foreground">{t.analytics.hint}</p>

        <section className="space-y-3">
          <SectionTitle>{t.analytics.distribution}</SectionTitle>
          {/* Barras, no una gráfica: son cinco números y se leen de un
              vistazo desde el fondo del aula. */}
          <div className="flex max-w-2xl items-end gap-3" style={{ height: '9rem' }}>
            {bands.map((band) => (
              <div key={band.from} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{band.students}</span>
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${(band.students / most) * 100}%`, minHeight: '2px' }}
                />
                <span className="text-micro text-muted-foreground">
                  {t.analytics.band(
                    toScale(band.from, scale),
                    toScale(band.to === 101 ? 100 : band.to - 1, scale)
                  )}
                </span>
              </div>
            ))}
          </div>
          {ungraded > 0 && (
            <p className="text-xs text-warning-strong">
              {t.analytics.ungraded(ungraded)} · {t.analytics.ungradedHint}
            </p>
          )}
        </section>

        <section className="space-y-2">
          <SectionTitle>{t.analytics.failingChecks}</SectionTitle>
          {failing.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.analytics.failingNone}</p>
          ) : (
            <div className="space-y-2">
              {failing.map((check) => {
                const rate = failRate(check)
                return (
                  <Card key={check.checkId}>
                    <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                      <span className="font-mono text-dense text-muted-foreground">
                        {check.checkId}
                      </span>
                      <span className="min-w-0 flex-1">{check.description}</span>
                      {check.failed > 0 && (
                        <Badge variant={rate !== null && rate >= 50 ? 'destructive' : 'secondary'}>
                          {t.analytics.failedBy(check.failed, check.evaluated)}
                        </Badge>
                      )}
                      {check.unevaluated > 0 && (
                        <Badge variant="warning">{t.analytics.couldNot(check.unevaluated)}</Badge>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <SectionTitle hint={t.analytics.byGroupHint}>{t.analytics.byGroup}</SectionTitle>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.analytics.byGroupNone}</p>
          ) : (
            <div className="max-w-2xl space-y-2">
              {groups.map((entry) => (
                <div key={entry.group} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{entry.group}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {entry.rate === null
                        ? t.analytics.byGroupNothing
                        : t.analytics.byGroupRate(entry.rate, entry.passed, entry.evaluated)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary/70"
                      style={{ width: `${entry.rate ?? 0}%` }}
                    />
                  </div>
                  {entry.unevaluated > 0 && (
                    <p className="text-micro text-muted-foreground">
                      {t.analytics.byGroupUnevaluated(entry.unevaluated)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
