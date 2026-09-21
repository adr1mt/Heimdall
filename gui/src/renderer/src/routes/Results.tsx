import { useMemo, useState } from 'react'
import { AlertTriangle, Download, Layers, RotateCcw, X } from 'lucide-react'
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Segmented,
  SegmentedItem,
  SectionTitle,
  Spinner,
  ViewHeader
} from '@/components/ui'
import { useApp, messageOf, noticeFrom } from '@/stores/app'
import { useRun } from '@/stores/run'
import {
  CAUSE_TEXT,
  NO_FILTERS,
  REMOTE_TEXT,
  STATUS_TEXT,
  STUDENT_TEXT,
  causesIn,
  filterRun,
  hasFilters,
  originText,
  pendingStudents,
  previousText,
  retryScope,
  scoreView,
  tally,
  truncationNote,
  type Filters,
  type Pending
} from '@/lib/results'
import {
  chainCsv,
  chainCsvName,
  chainExportSummary,
  csvName,
  exportSummary,
  scaleOf,
  toCsv
} from '@/lib/export'
import { attemptsText, chainTally, chainText, fromRunText } from '@/lib/chain'
import { machineLiterals, maskerFor } from '@/lib/projector'
import type { Consolidation, ConsolidatedCheck } from '../../../shared/consolidation'
import type { AcademicStatus } from '../../../shared/events'
import type { CheckResult, RunResult, Stream, StudentResult } from '../../../shared/artifact'
import { cn } from '@/lib/utils'
import { t } from '@/i18n/es'

/** Which cell the teacher opened, by student and check. */
interface Selection {
  studentId: string
  checkId: string
}

export default function ResultsView() {
  const artifact = useRun((s) => s.artifact)
  const artifactPath = useRun((s) => s.artifactPath)
  const problem = useRun((s) => s.artifactProblem)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [selected, setSelected] = useState<Selection | null>(null)

  const mask = useMask(artifact)
  const rows = useMemo(() => (artifact ? filterRun(artifact, filters) : []), [artifact, filters])
  const causes = useMemo(() => (artifact ? causesIn(artifact) : []), [artifact])

  const chosen = useMemo(() => {
    if (!artifact || !selected) return null
    const student = artifact.students.find((s) => s.student_id === selected.studentId)
    const check = student?.checks.find((c) => c.check_id === selected.checkId)
    return student && check ? { student, check } : null
  }, [artifact, selected])

  if (problem) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title={t.results.title} />
        <p role="alert" className="m-6 rounded-md bg-destructive/10 p-4 text-sm text-destructive-strong">
          {problem}
        </p>
      </div>
    )
  }

  if (!artifact) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title={t.results.title} />
        <p className="m-6 text-sm text-muted-foreground">{t.results.empty}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t.results.title} />
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-6">
        <div className="space-y-1">
          <p className="text-sm">
            {artifact.exam.path.split('/').pop()} · {artifact.inventory.path.split('/').pop()}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.results.plan(
              artifact.students.length,
              artifact.plan.check_count,
              artifact.plan.total_weight
            )}
          </p>
          {/* Which correction these grades come from, always. */}
          <p className="text-xs text-muted-foreground">{originText(artifact)}</p>
        </div>

        <ExportButton />

        <PendingPanel artifactPath={artifactPath} />

        <ChainPanel artifactPath={artifactPath} />

        {artifact.warnings && artifact.warnings.length > 0 && (
          <div className="space-y-1.5 rounded-md bg-warning/10 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-warning-strong">
              <AlertTriangle className="h-4 w-4" />
              {t.results.warnings}
            </div>
            {artifact.warnings.map((warning, index) => (
              <p key={index} className="text-xs text-warning-strong/90">
                <span className="font-mono">{warning.scope}</span> · {mask(warning.message)}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder={t.results.filterText}
            value={filters.text}
            onChange={(e) => setFilters({ ...filters, text: e.target.value })}
          />
          <Segmented>
            {(['ALL', 'PASS', 'FAIL', 'UNEVALUATED'] as const).map((status) => (
              <SegmentedItem
                key={status}
                active={filters.status === status}
                onClick={() => setFilters({ ...filters, status })}
              >
                {status === 'ALL' ? t.results.filterAll : STATUS_TEXT[status]}
              </SegmentedItem>
            ))}
          </Segmented>
          {causes.length > 0 && (
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label={t.results.filterCause}
              value={filters.cause}
              onChange={(e) => setFilters({ ...filters, cause: e.target.value as Filters['cause'] })}
            >
              <option value="ALL">{t.results.filterCause}: {t.results.filterAll.toLowerCase()}</option>
              {causes.map((cause) => (
                <option key={cause} value={cause}>
                  {CAUSE_TEXT[cause]}
                </option>
              ))}
            </select>
          )}
          {hasFilters(filters) && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
              {t.results.clear}
            </Button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.results.noMatches}</p>
        ) : (
          <div className="space-y-2">
            {rows.map(({ student, checks }) => (
              <StudentRow
                key={student.student_id}
                student={student}
                checks={checks}
                selected={selected}
                onPick={(checkId) => setSelected({ studentId: student.student_id, checkId })}
              />
            ))}
          </div>
        )}

        {chosen ? (
          <CheckDetail
            student={chosen.student}
            check={chosen.check}
            onClose={() => setSelected(null)}
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t.results.pick}</p>
        )}
      </div>
    </div>
  )
}

/**
 * The masking in force for this correction.
 *
 * The literals come from the artifact itself —every machine it names— so a
 * host called `alu1.aula` is covered as well as its address, and they are
 * gathered once for the whole screen: the warnings, the commands and the
 * output of every student all name the same machines.
 */
function useMask(artifact: RunResult | null): (text: string) => string {
  const projector = useApp((s) => s.projector)
  return useMemo(() => {
    const values: (string | undefined)[] = []
    for (const student of artifact?.students ?? []) {
      for (const check of student.checks) {
        values.push(check.execution?.host, check.execution?.address, check.execution?.user)
      }
    }
    return maskerFor(projector, machineLiterals(values))
  }, [projector, artifact])
}

/**
 * Taking the grades out of the application.
 *
 * It asks first and says what is going out, because a grade sheet leaves the
 * teacher's hands. What it writes is read from the artifact and converted to
 * the teacher's scale; the correction on disk is not touched, and a student
 * without a final grade travels as «sin nota» with the reason.
 */
function ExportButton() {
  const artifact = useRun((s) => s.artifact)
  const scaleId = useApp((s) => s.scale)
  const setNotice = useApp((s) => s.setNotice)
  const [confirm, setConfirm] = useState(false)
  const scale = scaleOf(scaleId)

  if (!artifact) return null

  async function save(): Promise<void> {
    setConfirm(false)
    if (!artifact) return
    try {
      const path = await window.heimdall.saveCsv(csvName(artifact), toCsv(artifact, scale))
      setNotice(path ? t.export.saved(path) : t.export.cancelled)
    } catch (error) {
      setNotice(noticeFrom(t.export.failed, error))
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
        <Download className="h-4 w-4" />
        {t.export.button}
      </Button>
      <ConfirmDialog
        open={confirm}
        title={t.export.title}
        confirmLabel={t.export.yes}
        onConfirm={() => void save()}
        onCancel={() => setConfirm(false)}
      >
        <span className="space-y-2 block">
          <span className="block">{exportSummary(artifact, scale)}</span>
          <span className="block">{t.export.hint}</span>
          <span className="block text-xs text-muted-foreground">{t.export.scale(scale.label)}</span>
        </span>
      </ConfirmDialog>
    </div>
  )
}


/**
 * The grade of a whole chain of corrections.
 *
 * It appears only when this correction repeats an earlier one, because that is
 * the only case where there is a chain to read. Pressing it runs `heimdall
 * consolidate`, which opens the artifacts already on disk and writes nothing:
 * the grade that comes back was closed by the engine, and this screen adds
 * nothing to it (ADR-0019). A chain the engine refuses shows its reason and no
 * grade at all.
 */
function ChainPanel({ artifactPath }: { artifactPath: string | null }) {
  const artifact = useRun((s) => s.artifact)
  const [chain, setChain] = useState<Consolidation | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!artifact?.retry_of || !artifactPath) return null

  async function read(): Promise<void> {
    if (!artifactPath) return
    setLoading(true)
    setProblem(null)
    setChain(null)
    try {
      setChain(await window.heimdall.consolidate(artifactPath))
    } catch (error) {
      setProblem(t.chain.refused(messageOf(error)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Layers className="h-4 w-4" />
        {t.chain.title}
      </div>
      <p className="max-w-3xl text-xs text-muted-foreground">{t.chain.hint}</p>

      <Button variant="outline" size="sm" disabled={loading} onClick={() => void read()}>
        {loading ? <Spinner /> : null}
        {chain ? t.chain.reload : t.chain.show}
      </Button>

      {loading && <p className="text-xs text-muted-foreground">{t.chain.loading}</p>}

      {problem && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive-strong">
          {problem}
        </p>
      )}

      {chain && !problem && <ChainResult chain={chain} />}
    </div>
  )
}

/** The class as the chain leaves it, student by student. */
function ChainResult({ chain }: { chain: Consolidation }) {
  const counts = chainTally(chain)
  const [selected, setSelected] = useState<Selection | null>(null)

  const chosen = useMemo(() => {
    if (!selected) return null
    const student = chain.students.find((s) => s.student_id === selected.studentId)
    const check = student?.checks.find((c) => c.check_id === selected.checkId)
    return student && check ? { name: student.name, check } : null
  }, [chain, selected])

  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground">{chainText(chain)}</p>
        <p className="text-xs text-muted-foreground">{t.chain.closed(counts.closed, counts.open)}</p>
      </div>

      <ChainExportButton chain={chain} />

      <div className="space-y-2">
        {chain.students.map((student) => {
          const score = scoreView(student.score)
          return (
            <div key={student.student_id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{student.name}</span>
                  <Badge variant={badgeOf(student.status)}>{STUDENT_TEXT[student.status]}</Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  {score.value == null ? (
                    <span className="text-sm text-muted-foreground">{t.results.noGrade}</span>
                  ) : (
                    <>
                      <span className="text-lg font-semibold tabular-nums">{score.value}</span>
                      {score.kind === 'provisional' && (
                        <span className="text-xs text-warning-strong">{t.results.provisional}</span>
                      )}
                    </>
                  )}
                  <span className="text-micro text-muted-foreground">{score.note}</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {student.checks.map((check) => (
                  <button
                    key={check.check_id}
                    type="button"
                    onClick={() => setSelected({ studentId: student.student_id, checkId: check.check_id })}
                    title={`${check.check_id} · ${STATUS_TEXT[check.status]} · ${fromRunText(check)}`}
                    aria-label={`${check.check_id}: ${STATUS_TEXT[check.status]}`}
                    className={cn(
                      'max-w-[14rem] truncate rounded px-2 py-1 text-micro font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      cellTone(check.status),
                      selected?.studentId === student.student_id &&
                        selected.checkId === check.check_id &&
                        'ring-2 ring-ring'
                    )}
                  >
                    {check.check_id}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {chosen && (
        <ChainCheckDetail
          name={chosen.name}
          check={chosen.check}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

/** One consolidated check: what it says, where it comes from and what came before. */
function ChainCheckDetail({
  name,
  check,
  onClose
}: {
  name: string
  check: ConsolidatedCheck
  onClose: () => void
}) {
  const attempts = attemptsText(check.attempts)
  // The technical reason names the machine that could not be reached.
  const mask = useMask(useRun((s) => s.artifact))
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionTitle>{t.results.checkTitle}</SectionTitle>
          <p className="mt-1 text-sm">
            <span className="font-mono">{check.check_id}</span> · {name}
          </p>
          {check.description && (
            <p className="text-xs text-muted-foreground">{check.description}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label={t.errors.dismiss} onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            check.status === 'PASS' ? 'success' : check.status === 'FAIL' ? 'destructive' : 'warning'
          }
        >
          {STATUS_TEXT[check.status]}
        </Badge>
        {check.cause !== 'NONE' && <Badge variant="warning">{CAUSE_TEXT[check.cause]}</Badge>}
        <span className="text-xs text-muted-foreground">
          {t.results.weight}: {check.weight}
        </span>
      </div>

      {check.detail && <p className="text-sm">{mask(check.detail)}</p>}

      <p className="text-xs text-muted-foreground">{fromRunText(check)}</p>

      {attempts.length > 0 && (
        <Field label={t.chain.attempts}>
          {attempts.map((line, index) => (
            <p key={index} className="text-dense">
              {line}
            </p>
          ))}
        </Field>
      )}

      <p className="text-xs text-muted-foreground">{t.chain.noEvidence}</p>
    </div>
  )
}

/** The chain's grades, out of the application, with the rules of one correction. */
function ChainExportButton({ chain }: { chain: Consolidation }) {
  const scaleId = useApp((s) => s.scale)
  const setNotice = useApp((s) => s.setNotice)
  const [confirm, setConfirm] = useState(false)
  const scale = scaleOf(scaleId)

  async function save(): Promise<void> {
    setConfirm(false)
    try {
      const path = await window.heimdall.saveCsv(chainCsvName(chain), chainCsv(chain, scale))
      setNotice(path ? t.export.saved(path) : t.export.cancelled)
    } catch (error) {
      setNotice(noticeFrom(t.export.failed, error))
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
        <Download className="h-4 w-4" />
        {t.chain.export}
      </Button>
      <ConfirmDialog
        open={confirm}
        title={t.chain.exportTitle}
        confirmLabel={t.export.yes}
        onConfirm={() => void save()}
        onCancel={() => setConfirm(false)}
      >
        <span className="space-y-2 block">
          <span className="block">{chainExportSummary(chain, scale)}</span>
          <span className="block">{t.chain.exportHint}</span>
          <span className="block text-xs text-muted-foreground">{t.export.scale(scale.label)}</span>
        </span>
      </ConfirmDialog>
    </div>
  )
}

/**
 * What was left unchecked, and the only two things the teacher may do about
 * it: nothing, or repeat what could not be evaluated (ADR-0018).
 *
 * Leaving it pending is the default and it is the safe one, so it is the
 * plain button and the retry is the one that asks for confirmation. Nothing
 * here can turn an unevaluated check into a fail or invent a final grade:
 * this panel starts a new run of the engine and that is all it does.
 */
function PendingPanel({ artifactPath }: { artifactPath: string | null }) {
  const artifact = useRun((s) => s.artifact)
  const setRetry = useApp((s) => s.setRetry)
  const setView = useApp((s) => s.setView)
  const [dismissed, setDismissed] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const pending = useMemo(() => (artifact ? pendingStudents(artifact) : []), [artifact])
  const scope = useMemo(() => (artifact ? retryScope(artifact) : null), [artifact])

  if (!artifact || pending.length === 0) return null
  if (dismissed) return <p className="text-xs text-muted-foreground">{t.pending.left}</p>

  function repeat(): void {
    setConfirm(false)
    if (!artifactPath || !scope) return
    setRetry({ artifactPath, students: scope.students, checks: scope.checks })
    setView('home')
  }

  return (
    <div className="space-y-3 rounded-md bg-warning/10 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-warning-strong">
        <AlertTriangle className="h-4 w-4" />
        {t.pending.title}
      </div>
      <p className="max-w-3xl text-xs text-warning-strong/90">{t.pending.hint}</p>

      <div className="space-y-1.5">
        {pending.map((row) => (
          <PendingRow key={row.student.student_id} row={row} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setDismissed(true)}>
          {t.pending.leave}
        </Button>
        {scope && artifactPath && (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
            <RotateCcw className="h-4 w-4" />
            {t.pending.retry(scope.checks, scope.students)}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        title={t.pending.confirmTitle}
        confirmLabel={t.pending.confirmYes}
        onConfirm={repeat}
        onCancel={() => setConfirm(false)}
      >
        {t.pending.confirmBody}
      </ConfirmDialog>
    </div>
  )
}

/**
 * One pending student, said in both units. Checks and weight are printed
 * apart because they are not the same measure: the checks do not weigh the
 * same, and one cipher alone invites reading a big hole as a small one
 * (ADR-0018 §7).
 */
function PendingRow({ row }: { row: Pending }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
      <span className="font-medium">{row.student.name}</span>
      <span className="text-muted-foreground">{t.pending.checks(row.checks, row.checkTotal)}</span>
      <span className="text-muted-foreground">{t.pending.weight(row.weight, row.weightTotal)}</span>
    </div>
  )
}

/** One student: the grade as it is allowed to be read, then their checks. */
function StudentRow({
  student,
  checks,
  selected,
  onPick
}: {
  student: StudentResult
  checks: CheckResult[]
  selected: Selection | null
  onPick: (checkId: string) => void
}) {
  const score = scoreView(student.score)
  const counts = tally(student.checks)

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{student.name}</span>
          <Badge variant={badgeOf(student.status)}>{STUDENT_TEXT[student.status]}</Badge>
        </div>
        <div className="flex items-baseline gap-2">
          {score.value == null ? (
            <span className="text-sm text-muted-foreground">{t.results.noGrade}</span>
          ) : (
            <>
              <span className="text-lg font-semibold tabular-nums">{score.value}</span>
              {score.kind === 'provisional' && (
                <span className="text-xs text-warning-strong">{t.results.provisional}</span>
              )}
            </>
          )}
          <span className="text-micro text-muted-foreground">{score.note}</span>
        </div>
      </div>

      <p className="mt-1 text-micro text-muted-foreground">
        {counts.pass} bien · {counts.fail} mal · {counts.unevaluated} sin evaluar
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        {checks.map((check) => (
          <button
            key={check.check_id}
            type="button"
            onClick={() => onPick(check.check_id)}
            title={`${check.check_id} · ${STATUS_TEXT[check.status]}${check.cause !== 'NONE' ? ` · ${CAUSE_TEXT[check.cause]}` : ''}`}
            aria-label={`${check.check_id}: ${STATUS_TEXT[check.status]}`}
            className={cn(
              'max-w-[14rem] truncate rounded px-2 py-1 text-micro font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              cellTone(check.status),
              selected?.studentId === student.student_id &&
                selected.checkId === check.check_id &&
                'ring-2 ring-ring'
            )}
          >
            {check.check_id}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The three academic states, each with its own colour. Unevaluated is amber and
 * never red: it is a technical problem, not a fail (principio 3).
 */
function cellTone(status: AcademicStatus): string {
  return status === 'PASS'
    ? 'bg-success/15 text-success-strong'
    : status === 'FAIL'
      ? 'bg-destructive/15 text-destructive-strong'
      : 'bg-warning/15 text-warning-strong'
}

function badgeOf(status: StudentResult['status']): 'success' | 'warning' | 'outline' | undefined {
  if (status === 'OK') return 'success'
  if (status === 'EXCLUDED') return 'outline'
  return 'warning'
}

/** Everything the artifact knows about one check, with nothing inferred. */
function CheckDetail({
  student,
  check,
  onClose
}: {
  student: StudentResult
  check: CheckResult
  onClose: () => void
}) {
  const execution = check.execution
  const projector = useApp((s) => s.projector)
  // The command, the output and the technical reason of a check are where the
  // address of the machine travels in plain sight.
  const mask = useMask(useRun((s) => s.artifact))
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionTitle>{t.results.checkTitle}</SectionTitle>
          <p className="mt-1 text-sm">
            <span className="font-mono">{check.check_id}</span> · {student.name}
          </p>
          {check.description && (
            <p className="text-xs text-muted-foreground">{check.description}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label={t.errors.dismiss} onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            check.status === 'PASS' ? 'success' : check.status === 'FAIL' ? 'destructive' : 'warning'
          }
        >
          {STATUS_TEXT[check.status]}
        </Badge>
        {check.cause !== 'NONE' && <Badge variant="warning">{CAUSE_TEXT[check.cause]}</Badge>}
        <span className="text-xs text-muted-foreground">
          {t.results.weight}: {check.weight}
        </span>
        {check.group && <span className="text-xs text-muted-foreground">{check.group}</span>}
      </div>

      {check.detail && <p className="text-sm">{mask(check.detail)}</p>}

      {check.previous && (
        <Field label={t.results.previous}>
          <p className="text-dense">{previousText(check.previous)}</p>
          {check.previous.detail && (
            <p className="text-xs text-muted-foreground">{mask(check.previous.detail)}</p>
          )}
        </Field>
      )}

      {check.assertion ? (
        <Field label={t.results.assertion}>
          <p className="text-dense">
            <span className="font-mono">{check.assertion.kind}</span> · {t.results.expected}:{' '}
            <span className="font-mono">{check.assertion.expected}</span>
          </p>
          <p className="text-dense">
            {t.results.found}:{' '}
            {check.assertion.found ? (
              <span className="font-mono">{check.assertion.found}</span>
            ) : (
              <span className="text-muted-foreground">{t.results.notFound}</span>
            )}
            {check.assertion.where && ` · ${t.results.where}: ${check.assertion.where}`}
          </p>
        </Field>
      ) : (
        <p className="text-xs text-muted-foreground">{t.results.noAssertion}</p>
      )}

      {execution ? (
        <>
          <Field label={t.results.command}>
            {/* The argument vector as it was sent. No shell ever built it. */}
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-dense">
              {mask(execution.command.join(' '))}
            </pre>
          </Field>
          <p className="text-xs text-muted-foreground">
            {t.results.machine}:{' '}
            {projector ? t.projector.masked : `${execution.user}@${execution.address}`} ·{' '}
            {t.results.exit}:{' '}
            {execution.exit_code ?? '—'} · {t.results.duration}: {execution.duration_ms} ms ·{' '}
            {t.results.attempts}: {execution.connect_attempts}/{execution.command_attempts}
          </p>
          {REMOTE_TEXT[execution.remote_process] && (
            <p className="text-xs text-warning-strong">{REMOTE_TEXT[execution.remote_process]}</p>
          )}
          <StreamBlock label={t.results.stdout} stream={execution.stdout} mask={mask} />
          <StreamBlock label={t.results.stderr} stream={execution.stderr} mask={mask} />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t.results.noExecution}</p>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

/** A student's output: untrusted data, shown as text and never as markup. */
function StreamBlock({
  label,
  stream,
  mask
}: {
  label: string
  stream: Stream
  mask: (text: string) => string
}) {
  const cut = truncationNote(stream)
  return (
    <Field label={label}>
      {stream.text ? (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-dense">
          {mask(stream.text)}
        </pre>
      ) : (
        <p className="text-xs text-muted-foreground">{t.results.emptyStream}</p>
      )}
      {cut && <p className="text-micro text-warning-strong">{cut}</p>}
    </Field>
  )
}
