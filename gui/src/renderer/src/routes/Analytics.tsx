import { AlertTriangle, TrendingDown } from 'lucide-react'
import { Badge, Card, CardContent, SectionTitle, ViewHeader } from '@/components/ui'
import { useApp, useScale } from '@/stores/app'
import { toScale } from '@/lib/scale'
import { useRun } from '@/stores/run'
import { attentionList, distribution, failRate, failingChecks, type Attention } from '@/lib/analytics'
import { t } from '@/i18n/es'

/**
 * Analíticas: who to walk over to first, and what the whole group is failing.
 *
 * It reads the very artifact Resultados is showing, so the two screens cannot
 * disagree: no number here is computed from anything but the grades the
 * engine already published (principio 12).
 */
export default function AnalyticsView() {
  const artifact = useRun((s) => s.artifact)
  const passMark = useApp((s) => s.passMark)
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
  const attention = attentionList(artifact, passMark)
  const failing = failingChecks(artifact)
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
          <SectionTitle>{t.analytics.attention}</SectionTitle>
          {attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.analytics.attentionNone}</p>
          ) : (
            <div className="space-y-2">
              {attention.map((entry) => (
                <AttentionRow key={entry.student.student_id} entry={entry} />
              ))}
            </div>
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
      </div>
    </div>
  )
}

/**
 * One student to walk over to. The technical problem is first and says so in
 * words: a machine nobody could reach looks like a student who did nothing
 * and needs the opposite reaction (principio 3).
 */
function AttentionRow({ entry }: { entry: Attention }) {
  const scale = useScale()
  const broken = entry.reason === 'BROKEN'
  return (
    <Card className={broken ? 'border-warning/40' : undefined}>
      <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
        {broken ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-strong" aria-hidden />
        ) : (
          <TrendingDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{entry.student.name}</span>
        {broken ? (
          <>
            <Badge variant="warning">{t.analytics.broken}</Badge>
            <span className="text-xs text-muted-foreground">
              {t.analytics.unevaluated(entry.unevaluated)}
            </span>
            {entry.detail && (
              <span className="w-full truncate text-xs text-muted-foreground">{entry.detail}</span>
            )}
          </>
        ) : (
          <>
            <Badge variant="secondary">{t.analytics.failing}</Badge>
            <span className="font-mono text-sm">{entry.score === null ? '—' : toScale(entry.score, scale)}</span>
          </>
        )}
      </CardContent>
    </Card>
  )
}
