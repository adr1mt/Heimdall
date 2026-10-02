import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, Grid3x3, Layers, List, RotateCcw, X } from 'lucide-react'
import {
  Badge,
  Button,
  ConfirmDialog,
  Foldaway,
  Input,
  Meter,
  MetaChip,
  Segmented,
  SegmentedItem,
  SectionTitle,
  Spinner,
  ViewHeader
} from '@/components/ui'
import { useApp, useScale, messageOf, noticeFrom } from '@/stores/app'
import { toScale } from '@/lib/scale'
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
import { MoodleExportButton } from '@/components/MoodleExport'
import {
  chainCsv,
  chainCsvName,
  chainExportSummary,
  chainGradeRows,
  gradeRows,
  csvName,
  exportSummary,
  toCsv
} from '@/lib/export'

import { classSummary, needsAttention, shortName, type ClassSummary } from '@/lib/summary'
import { buildMatrix, type MatrixRow } from '@/lib/matrix'
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

/**
 * The two ways of reading the same correction, never two sections.
 *
 * The list answers «how is each student doing», the matrix «which check is
 * failing everybody». They are the same data and the same filters: switching
 * is a question, not a navigation.
 */
type Mode = 'list' | 'matrix'

export default function ResultsView() {
  const artifact = useRun((s) => s.artifact)
  const artifactPath = useRun((s) => s.artifactPath)
  const problem = useRun((s) => s.artifactProblem)
  const passMark = useApp((s) => s.passMark)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [mode, setMode] = useState<Mode>('list')
  const [selected, setSelected] = useState<Selection | null>(null)
  const [openStudent, setOpenStudent] = useState<string | null>(null)

  const mask = useMask(artifact)
  const causes = useMemo(() => (artifact ? causesIn(artifact) : []), [artifact])
  const summary = useMemo(
    () => (artifact ? classSummary(artifact, passMark) : null),
    [artifact, passMark]
  )

  // The students on screen: the filters narrow the checks, «requieren
  // atención» narrows the class. Both views read this same list, so the two
  // modes can never disagree about who is there.
  const rows = useMemo(() => {
    if (!artifact) return []
    const filtered = filterRun(artifact, filters)
    if (!attentionOnly) return filtered
    return filtered.filter((row) => needsAttention(row.student, passMark))
  }, [artifact, filters, attentionOnly, passMark])

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

  const filtering = hasFilters(filters) || attentionOnly

  function clear(): void {
    setFilters(NO_FILTERS)
    setAttentionOnly(false)
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={t.results.title}
        meta={
          <MetaChip>
            {t.results.plan(
              artifact.students.length,
              artifact.plan.check_count,
              artifact.plan.total_weight
            )}
          </MetaChip>
        }
        actions={
          <>
            <Input
              className="w-56"
              placeholder={t.results.filterText}
              value={filters.text}
              onChange={(e) => setFilters({ ...filters, text: e.target.value })}
            />
            <Segmented>
              <SegmentedItem active={mode === 'list'} onClick={() => setMode('list')}>
                <List className="h-3.5 w-3.5" />
                {t.results.modeList}
              </SegmentedItem>
              <SegmentedItem active={mode === 'matrix'} onClick={() => setMode('matrix')}>
                <Grid3x3 className="h-3.5 w-3.5" />
                {t.results.modeMatrix}
              </SegmentedItem>
            </Segmented>
            <ExportButton />
            <RunMoodleButton />
          </>
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        {summary && (
          <>
            <KpiStrip
              summary={summary}
              attentionOnly={attentionOnly}
              onAttention={() => setAttentionOnly((on) => !on)}
            />
            <States />
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Segmented>
            {(['ALL', 'PASS', 'FAIL', 'UNEVALUATED'] as const).map((status) => (
              <SegmentedItem
                key={status}
                active={filters.status === status}
                onClick={() => setFilters({ ...filters, status })}
                title={status === 'ALL' ? t.results.filterAll : STATE_TEXT[status]}
              >
                {status === 'ALL' ? t.results.filterAll : STATUS_TEXT[status]}
              </SegmentedItem>
            ))}
          </Segmented>
          {causes.length > 0 && (
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              aria-label={t.results.filterCause}
              value={filters.cause}
              onChange={(e) => setFilters({ ...filters, cause: e.target.value as Filters['cause'] })}
            >
              <option value="ALL">
                {t.results.filterCause}: {t.results.filterAll.toLowerCase()}
              </option>
              {causes.map((cause) => (
                <option key={cause} value={cause}>
                  {CAUSE_TEXT[cause]}
                </option>
              ))}
            </select>
          )}
          {filtering && (
            <Button variant="ghost" size="sm" onClick={clear}>
              {t.results.clear}
            </Button>
          )}
          <span className="ml-auto text-micro text-muted-foreground">{originText(artifact)}</span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.results.noMatches}</p>
        ) : mode === 'list' ? (
          <div className="grid gap-1.5 xl:grid-cols-2">
            {rows.map(({ student, checks }) => (
              <StudentRow
                key={student.student_id}
                student={student}
                checks={checks}
                open={openStudent === student.student_id}
                selected={selected}
                onToggle={() =>
                  setOpenStudent((current) =>
                    current === student.student_id ? null : student.student_id
                  )
                }
                onPick={(checkId) => setSelected({ studentId: student.student_id, checkId })}
              />
            ))}
          </div>
        ) : (
          <MatrixView rows={rows} selected={selected} onPick={setSelected} />
        )}

        {chosen && (
          <CheckDetail
            student={chosen.student}
            check={chosen.check}
            onClose={() => setSelected(null)}
          />
        )}

        <PendingPanel artifactPath={artifactPath} />

        <ChainPanel artifactPath={artifactPath} />

        {artifact.warnings && artifact.warnings.length > 0 && (
          <Foldaway
            tone="warning"
            icon={<AlertTriangle className="h-4 w-4 shrink-0" />}
            summary={t.results.warningsFolded(artifact.warnings.length)}
          >
            {artifact.warnings.map((warning, index) => (
              <p key={index} className="text-xs text-warning-strong/90">
                <span className="font-mono">{warning.scope}</span> · {mask(warning.message)}
              </p>
            ))}
          </Foldaway>
        )}
      </div>
    </div>
  )
}

/**
 * How the class is doing, before any detail. Three readings and no more: the
 * fourth number nobody looks at is what pushed the students off the screen.
 *
 * «Requieren atención» is the only one that is a button, because it is the
 * only one that is a question with an answer: who do I walk over to.
 */
function KpiStrip({
  summary,
  attentionOnly,
  onAttention
}: {
  summary: ClassSummary
  attentionOnly: boolean
  onAttention: () => void
}) {
  const scale = useScale()
  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
      <Reading
        value={`${summary.passed}/${summary.graded}`}
        label={t.results.kpiPassed}
        hint={t.results.kpiPassedHint(summary.graded, summary.students)}
      />
      <Reading
        value={summary.average === null ? '—' : toScale(summary.average, scale)}
        label={t.results.kpiAverage}
        hint={
          summary.average === null
            ? t.results.kpiNoGrades
            : t.results.kpiAverageHint(toScale(scale.passMark, scale), scale.max)
        }
      />
      <button
        type="button"
        aria-pressed={attentionOnly}
        onClick={onAttention}
        className={cn(
          'flex items-baseline gap-3 bg-background px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          attentionOnly && 'bg-accent'
        )}
      >
        <span
          className={cn(
            'text-figure font-bold tabular-nums',
            summary.attention > 0 ? 'text-warning-strong' : 'text-muted-foreground'
          )}
        >
          {summary.attention}
        </span>
        <span className="min-w-0">
          <span className="block text-micro uppercase tracking-[0.09em] text-muted-foreground">
            {t.results.kpiAttention}
          </span>
          <span className="block text-xs text-muted-foreground">{t.results.kpiAttentionHint}</span>
        </span>
      </button>
    </div>
  )
}

/**
 * «Bien», «mal» y «sin evaluar», dichas con palabras y una sola vez.
 *
 * Las tres etiquetas están por toda la pantalla —en los filtros, en la lista,
 * en la matriz— y la tercera es la que hay que explicar: quien la lee como un
 * fallo del alumno saca la conclusión contraria a la correcta (principio 3).
 */
function States() {
  return (
    <div className="space-y-1 rounded-md border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">{t.results.statesTitle}</p>
      <p>{t.results.statePass}</p>
      <p>{t.results.stateFail}</p>
      <p>{t.results.stateUnevaluated}</p>
    </div>
  )
}

/** La frase de cada estado, para el filtro que lleva su etiqueta. */
const STATE_TEXT: Record<AcademicStatus, string> = {
  PASS: t.results.statePass,
  FAIL: t.results.stateFail,
  UNEVALUATED: t.results.stateUnevaluated
}

function Reading({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-3 bg-background px-4 py-3">
      <span className="text-figure font-bold tabular-nums">{value}</span>
      <span className="min-w-0">
        <span className="block text-micro uppercase tracking-[0.09em] text-muted-foreground">
          {label}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </div>
  )
}

/**
 * The matrix: checks down, students across, as Teutón GUI had it.
 *
 * Amber is never red. A check nobody could evaluate is a technical incident
 * and an entire amber column is a machine that did not answer, which is the
 * opposite reaction to a column of failures (principio 3).
 */
function MatrixView({
  rows,
  selected,
  onPick
}: {
  rows: { student: StudentResult; checks: CheckResult[] }[]
  selected: Selection | null
  onPick: (selection: Selection) => void
}) {
  const scale = useScale()
  const matrix = useMemo(() => buildMatrix(rows), [rows])
  const names = useMemo(() => {
    const taken: string[] = []
    return matrix.students.map((student) => {
      const short = shortName(student.name, taken)
      taken.push(short.split(' ')[0])
      return short
    })
  }, [matrix])

  return (
    <div className="space-y-2">
      <Legend />
      <div className="overflow-auto rounded-md border border-border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="sticky left-0 z-10 bg-secondary/40 px-3 py-2 text-micro uppercase tracking-[0.09em] text-muted-foreground">
                {t.results.matrixCheck}
              </th>
              {names.map((name, index) => (
                <th
                  key={matrix.students[index].student_id}
                  className="px-1 py-2 text-center text-xs font-semibold"
                  title={matrix.students[index].name}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <MatrixRowView
                key={row.checkId}
                row={row}
                students={matrix.students}
                selected={selected}
                onPick={onPick}
              />
            ))}
            <tr className="border-t border-border bg-secondary/40">
              <th className="sticky left-0 z-10 bg-secondary/40 px-3 py-2 text-xs font-semibold">
                {t.results.matrixScore}
              </th>
              {matrix.students.map((student) => {
                const score = scoreView(student.score, scale)
                return (
                  <td
                    key={student.student_id}
                    className="px-1 py-2 text-center text-xs font-semibold tabular-nums"
                  >
                    {score.value === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={score.kind === 'provisional' ? 'text-warning-strong' : ''}>
                        {score.text}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MatrixRowView({
  row,
  students,
  selected,
  onPick
}: {
  row: MatrixRow
  students: StudentResult[]
  selected: Selection | null
  onPick: (selection: Selection) => void
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <th
        scope="row"
        className="sticky left-0 z-10 max-w-xs truncate bg-background px-3 py-1.5 text-left text-xs font-normal"
        title={`${row.group} · ${row.description}`}
      >
        {row.description}{' '}
        <span className="text-muted-foreground">{t.results.matrixWeight(row.weight)}</span>
      </th>
      {row.cells.map((check, index) => {
        const student = students[index]
        if (!check) {
          return (
            <td key={student.student_id} className="px-1 py-1.5 text-center">
              <span
                className="inline-block rounded px-1.5 py-0.5 text-glyph text-muted-foreground"
                title={t.results.legendMissing}
              >
                ·
              </span>
            </td>
          )
        }
        const active =
          selected?.studentId === student.student_id && selected.checkId === check.check_id
        return (
          <td key={student.student_id} className="px-1 py-1.5 text-center">
            <button
              type="button"
              onClick={() => onPick({ studentId: student.student_id, checkId: check.check_id })}
              title={`${student.name} · ${row.description} · ${STATUS_TEXT[check.status]}${check.cause !== 'NONE' ? ` · ${CAUSE_TEXT[check.cause]}` : ''}`}
              aria-label={`${student.name}, ${row.description}: ${STATUS_TEXT[check.status]}`}
              className={cn(
                'inline-flex h-6 w-7 items-center justify-center rounded text-glyph font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                cellTone(check.status),
                active && 'ring-2 ring-ring'
              )}
            >
              {GLYPH[check.status]}
            </button>
          </td>
        )
      })}
    </tr>
  )
}

/** The three academic states, spelled out once above the grid. */
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {(['PASS', 'FAIL', 'UNEVALUATED'] as const).map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex h-5 w-6 items-center justify-center rounded text-glyph font-bold',
              cellTone(status)
            )}
          >
            {GLYPH[status]}
          </span>
          {status === 'PASS'
            ? t.results.legendPass
            : status === 'FAIL'
              ? t.results.legendFail
              : t.results.legendUnevaluated}
        </span>
      ))}
    </div>
  )
}

const GLYPH: Record<AcademicStatus, string> = {
  PASS: 'OK',
  FAIL: '✕',
  UNEVALUATED: '?'
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
  const scale = useScale()
  const setNotice = useApp((s) => s.setNotice)
  const [confirm, setConfirm] = useState(false)

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


/** The same grades of this correction, in the file Moodle imports. */
function RunMoodleButton() {
  const artifact = useRun((s) => s.artifact)
  const scale = useScale()
  if (!artifact) return null
  return (
    <MoodleExportButton
      rows={gradeRows(artifact, scale)}
      at={artifact.finished_at}
    />
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
    <Foldaway
      icon={<Layers className="h-4 w-4 shrink-0" />}
      summary={`${t.chain.title} · ${t.chain.folded}`}
    >
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
    </Foldaway>
  )
}

/** The class as the chain leaves it, student by student. */
function ChainResult({ chain }: { chain: Consolidation }) {
  const counts = chainTally(chain)
  const scale = useScale()
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

      <div className="flex flex-wrap gap-2">
        <ChainExportButton chain={chain} />
        <MoodleExportButton
          rows={chainGradeRows(chain, scale)}
          at={chain.runs[chain.runs.length - 1]?.finished_at ?? ''}
        />
      </div>

      <div className="space-y-2">
        {chain.students.map((student) => {
          const score = scoreView(student.score, scale)
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
                      <span className="text-lg font-semibold tabular-nums">{score.text}</span>
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
  const scale = useScale()
  const setNotice = useApp((s) => s.setNotice)
  const [confirm, setConfirm] = useState(false)

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

  const [effective, setEffective] = useState<{ path: string; chain: Consolidation } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    setEffective(null)
    setProblem(null)
    setDismissed(false)
    setConfirm(false)
    if (artifact?.retry_of && artifactPath) {
      void window.heimdall.consolidate(artifactPath).then(chain => {
        if (current) setEffective({ path: artifactPath, chain })
      }).catch(error => { if (current) setProblem(messageOf(error)) })
    }
    return () => { current = false }
  }, [artifact, artifactPath])
  const source = artifact?.retry_of
    ? (effective?.path === artifactPath ? effective.chain : null)
    : artifact
  const pending = useMemo(() => source ? pendingStudents(source) : [], [source])
  const scope = useMemo(() => source ? retryScope(source) : null, [source])

  if (problem) return <p role="alert" className="text-sm text-destructive-strong">{problem}</p>
  if (!artifact || pending.length === 0) return null
  if (dismissed) return <p className="text-xs text-muted-foreground">{t.pending.left}</p>

  function repeat(): void {
    setConfirm(false)
    if (!artifactPath || !scope) return
    setRetry({ artifactPath, students: scope.students, checks: scope.checks })
    setView('home')
  }

  return (
    <Foldaway
      tone="warning"
      icon={<AlertTriangle className="h-4 w-4 shrink-0" />}
      summary={`${t.pending.title}: ${t.pending.folded(pending.length)}`}
    >
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
    </Foldaway>
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
  open,
  selected,
  onToggle,
  onPick
}: {
  student: StudentResult
  checks: CheckResult[]
  open: boolean
  selected: Selection | null
  onToggle: () => void
  onPick: (checkId: string) => void
}) {
  const scale = useScale()
  const score = scoreView(student.score, scale)
  const counts = tally(student.checks)
  // The technical reason is read without opening anything: a machine that did
  // not answer looks exactly like a student who did nothing, and the teacher
  // has to tell them apart from the row itself.
  const cause = student.checks.find((check) => check.cause !== 'NONE')?.cause

  return (
    <div className={cn('rounded-md border border-border', open && 'ring-1 ring-ring')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{student.name}</span>
          {cause && (
            <span className="block truncate text-micro text-warning-strong">{CAUSE_TEXT[cause]}</span>
          )}
        </span>
        <Meter
          className="hidden w-24 shrink-0 sm:block"
          value={counts.pass}
          total={student.checks.length}
          tone={counts.pass === student.checks.length && counts.pass > 0 ? 'pass' : 'neutral'}
        />
        <span className="w-10 shrink-0 text-right text-micro tabular-nums text-muted-foreground">
          {t.results.passedOf(counts.pass, student.checks.length)}
        </span>
        <span className="w-12 shrink-0 text-right">
          {score.value === null ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                score.kind === 'provisional' && 'text-warning-strong'
              )}
              title={score.note}
            >
              {score.text}
            </span>
          )}
        </span>
        <Badge variant={badgeOf(student.status)}>{STUDENT_TEXT[student.status]}</Badge>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border p-3">
          <p className="text-micro text-muted-foreground">
            {t.run.counts(counts.pass, counts.fail, counts.unevaluated)} · {score.note}
          </p>
          <div className="flex flex-wrap gap-1">
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
      )}
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
            {check.assertion.evidence_truncated && <span className="text-warning-strong">Se muestra un extracto de la evidencia; la comparación se hizo antes de recortarla.</span>}
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
