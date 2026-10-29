import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ProjectorCanvas } from '@/components/ProjectorCanvas'
import { CorrectionClock } from '@/components/CorrectionClock'
import {
  ArrowLeft,
  Check,
  AlertTriangle,
  Download,
  EyeOff,
  Grid3x3,
  Layers,
  List,
  RotateCcw,
  X
} from 'lucide-react'
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
import { useRun } from '@/stores/run'
import { useResultsView } from '@/stores/results-view'
import {
  CAUSE_TEXT,
  REMOTE_TEXT,
  STATUS_TEXT,
  STUDENT_TEXT,
  causesIn,
  filterRun,
  exploreResults,
  hasFilters,
  originText,
  pendingStudents,
  previousText,
  retryScope,
  scoreView,
  tally,
  truncationNote,
  type Filters,
  type StudentOrder,
  type Pending
} from '@/lib/results'
import { MoodleExportButton } from '@/components/MoodleExport'
import { ReportsButton } from '@/components/ReportsButton'
import { useExamRecord } from '@/stores/exam-record'
import { FinalGrades, ExamSessionActions } from '@/components/ExamSession'
import { useBoundExam, useSessionGrade } from '@/lib/use-session-grade'
import { sessionGrade } from '@/lib/session-grade'
import {
  savedExamCsv, savedExamCsvName, savedExamRows, sessionExportSummary,
  chainCsv,
  chainCsvName,
  chainExportSummary,
  chainGradeRows,
  gradeRows,
  csvName,
  exportSummary,
  toCsv
} from '@/lib/export'

import { averageText, classSummary, displayedAverage, studentShortNames, type ClassSummary } from '@/lib/summary'
import { failingChecks, type FailingCheck } from '@/lib/analytics'
import { buildMatrix, type MatrixRow } from '@/lib/matrix'
import { attemptsText, chainTally, chainText, fromRunText } from '@/lib/chain'
import { machineLiterals, maskerFor } from '@/lib/projector'
import type { Consolidation, ConsolidatedCheck } from '../../../shared/consolidation'
import type { AcademicStatus } from '../../../shared/events'
import type { CheckResult, RunResult, Stream, StudentResult } from '../../../shared/artifact'
import { gradeAppearance } from '@/lib/grade-appearance'
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
export default function ResultsView() {
  const artifact = useRun((s) => s.artifact)
  const projector = useApp((s) => s.projector)
  const artifactPath = useRun((s) => s.artifactPath)
  const problem = useRun((s) => s.artifactProblem)
  const scale = useScale()
  const passMark = scale.passMark
  const savedExam = useBoundExam()
  const saved = useExamRecord(s => s.saved)
  const showFinals = useExamRecord(s => s.showFinals)
  const gradeRun = useMemo(() => artifact && savedExam ? { ...artifact, students: artifact.students.map(student => sessionGrade(student, savedExam).student) } : artifact, [artifact, savedExam])
  const { filters, setFilters, studentFilter, setStudentFilter, order, setOrder,
    mode, setMode, hiddenIds, hideStudent, showStudent, showAll, clearFilters } = useResultsView()
  const [selected, setSelected] = useState<Selection | null>(null)
  const [openStudent, setOpenStudent] = useState<string | null>(null)

  useEffect(() => {
    setOpenStudent(null)
    setSelected(null)
  }, [artifact?.run_id])

  const mask = useMask(artifact)
  const causes = useMemo(() => (artifact ? causesIn(artifact) : []), [artifact])
  const names = useMemo(() => studentShortNames(artifact?.students ?? []), [artifact])
  const summary = useMemo(
    () => (gradeRun ? classSummary(gradeRun, passMark) : null),
    [gradeRun, passMark]
  )

  const average = useMemo(() => gradeRun ? displayedAverage(gradeRun, scale) : null, [gradeRun, scale])
  const mostFailed = useMemo(() => {
    const checks = artifact ? failingChecks(artifact).filter((check) => check.failed > 0) : []
    return checks.filter((check) => check.failed === checks[0]?.failed)
  }, [artifact])

  // Both views share the same student ordering and check filters.
  const rows = useMemo(() => {
    if (!artifact || !gradeRun) return []
    const latest = new Map(artifact.students.map(student => [student.student_id, student]))
    return exploreResults(filterRun(gradeRun, filters), studentFilter, order, passMark, hiddenIds)
      .map(row => ({ ...row, student: latest.get(row.student.student_id)! }))
  }, [artifact, gradeRun, filters, studentFilter, order, passMark, hiddenIds])

  if (saved?.record.state === 'FINALIZED' && showFinals) return <FinalGrades saved={saved} />

  if (problem && !artifact) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title={t.results.title} actions={<ExamSessionActions />} />
        <p
          role="alert"
          className="m-6 rounded-md bg-destructive/10 p-4 text-sm text-destructive-strong"
        >
          {problem}
        </p>
      </div>
    )
  }

  if (!artifact) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title={t.results.title} actions={<ExamSessionActions />} />
        <p className="m-6 text-sm text-muted-foreground">{t.results.empty}</p>
      </div>
    )
  }

  const warnings = (artifact.warnings ?? []).filter(
    (warning) => !projector || warning.code !== 'HOST_KEY_ACCEPTED'
  )
  const filtering = hasFilters(filters) || studentFilter !== 'all'
  const exploring = filtering || order !== 'name'
  const hiddenStudents = artifact.students.filter((student) => hiddenIds.includes(student.student_id))

  const detailed = artifact.students.find((student) => student.student_id === openStudent)
  if (detailed)
    return (
      <StudentDetailView
        student={detailed}
        selected={selected?.checkId ?? null}
        onBack={() => {
          setOpenStudent(null)
          setSelected(null)
        }}
        onPick={(checkId) =>
          setSelected(checkId ? { studentId: detailed.student_id, checkId } : null)
        }
      />
    )

  const overview = <div className="results-overview space-y-2">
        {summary && projector && <details className="text-xs">
          <summary className="cursor-pointer py-1 text-muted-foreground">Resumen de toda la corrección · {summary.passed} aprobados</summary>
          <KpiStrip summary={summary} average={average} mostFailed={mostFailed} />
        </details>}
        {summary && !projector && (
          <section aria-label="Resumen de toda la corrección">
            <KpiStrip summary={summary} average={average} mostFailed={mostFailed} />
          </section>
        )}

        <div className="space-y-1">
          <div className="results-filters flex flex-wrap items-center gap-2">
            <Input
              className="h-8 w-full sm:w-56"
              aria-label={t.results.filterText}
              placeholder={t.results.filterText}
              value={filters.text}
              onChange={(e) => setFilters({ ...filters, text: e.target.value })}
            />
            <Segmented aria-label="Filtrar alumnos" className="max-w-full flex-wrap">
              {([
                ['all', 'Todos'], ['evaluated', 'Evaluados'], ['pass', 'Aprobados'], ['fail', 'Suspensos'], ['ungraded', 'Sin evaluar']
              ] as const).map(([value, label]) => (
                <SegmentedItem key={value} active={studentFilter === value}
                  onClick={() => setStudentFilter(value)}
                  title={value === 'evaluated' ? 'Se pudo conectar con su máquina; puede haber comprobaciones pendientes'
                    : value === 'ungraded' ? 'Sin nota final o con comprobaciones pendientes' : label}>
                  {label}
                </SegmentedItem>
              ))}
            </Segmented>
            <label className="flex items-center gap-2 text-xs text-muted-foreground sm:ml-auto">
              Ordenar
              <select
                className={cn('h-8 max-w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring', order !== 'name' && 'border-primary')}
                aria-label="Ordenar alumnos"
                value={order}
                onChange={(e) => setOrder(e.target.value as StudentOrder)}
              >
                <option value="name">Nombre</option>
                <option value="grade-asc">Nota: menor a mayor</option>
                <option value="grade-desc">Nota: mayor a menor</option>
                <option value="failures">Más comprobaciones falladas</option>
              </select>
            </label>
            {exploring && <Button variant="ghost" size="sm" onClick={clearFilters}>Restablecer</Button>}
          </div>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
            <p role="status" className="py-1 text-xs text-muted-foreground">
              {rows.length} de {artifact.students.length} alumnos · {hiddenStudents.length} ocultos
              {filtering && ' · Filtros activos'}
              {order !== 'name' && ' · Orden personalizado'}
            </p>
            {hiddenStudents.length > 0 && (
              <details className="w-full text-xs sm:w-auto">
                <summary className="w-fit cursor-pointer rounded px-2 py-1 text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                  Ocultos ({hiddenStudents.length})
                </summary>
                <div className="mt-2 max-h-64 space-y-1 overflow-auto rounded-md border border-border p-2">
                  <p className="px-2 py-1 text-muted-foreground">Solo se ocultan en estas vistas durante la sesión.</p>
                  <Button variant="ghost" size="sm" onClick={showAll}>Mostrar todos</Button>
                  {hiddenStudents.map((student) => (
                    <div key={student.student_id} className="flex items-center gap-3 px-2 py-1">
                      <span className="min-w-0 flex-1 wrap-break-word">{student.name}</span>
                      <Button variant="ghost" size="sm" aria-label={`Mostrar a ${student.name}`}
                        onClick={() => showStudent(student.student_id)}>Mostrar</Button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          <details className="min-w-0 py-1 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Filtrar comprobaciones y ver estados{hasFilters(filters) ? ' · filtros activos' : ''}
            </summary>
            <div className="my-2 flex flex-wrap items-center gap-2">
              <Segmented aria-label="Filtrar comprobaciones">
                {(['ALL', 'PASS', 'FAIL', 'UNEVALUATED'] as const).map((status) => (
                  <SegmentedItem key={status} active={filters.status === status}
                    onClick={() => setFilters({ ...filters, status })}
                    title={status === 'ALL' ? t.results.filterAll : STATE_TEXT[status]}>
                    {status === 'ALL' ? t.results.filterAll : STATUS_TEXT[status]}
                  </SegmentedItem>
                ))}
              </Segmented>
              {causes.length > 0 && (
                <select className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  aria-label={t.results.filterCause} value={filters.cause}
                  onChange={(e) => setFilters({ ...filters, cause: e.target.value as Filters['cause'] })}>
                  <option value="ALL">{t.results.filterCause}: {t.results.filterAll.toLowerCase()}</option>
                  {causes.map((cause) => <option key={cause} value={cause}>{CAUSE_TEXT[cause]}</option>)}
                </select>
              )}
              <span className="ml-auto text-micro text-muted-foreground">{originText(artifact)}</span>
            </div>
            <States />
          </details>
          </div>
          {studentFilter === 'evaluated' && (
            <p className="text-xs text-muted-foreground">Se pudo conectar con su máquina; puede haber comprobaciones pendientes.</p>
          )}
        </div>

  </div>

  return (
    <div className={cn('flex h-full flex-col', !projector && 'teacher-results')}>
      <ViewHeader
        title={t.results.title}
        meta={
          <MetaChip>
            {artifact.students.length} alumnos · {artifact.plan.check_count} comprobaciones
          </MetaChip>
        }
        actions={
          <>
            <ExamSessionActions />
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
            {!projector && (
              <>
                <ReportsButton artifactPath={artifactPath} />
                <details className="relative">
                  <summary
                    className="cursor-pointer rounded px-2 py-1 text-sm"
                    aria-label="Más opciones"
                  >
                    •••
                  </summary>
                  <div className="absolute right-0 z-30 w-max space-y-2 rounded-md border border-border bg-popover p-2">
                    <RunMoodleButton />
                    <ExportButton />
                  </div>
                </details>
              </>
            )}
          </>
        }
      />

      <CorrectionClock />
      <SessionResultsHint />
      <ResultsCanvas projector={projector} overview={overview}>
      <div className="results-body space-y-3 p-3 sm:p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{hiddenStudents.length === artifact.students.length
            ? 'Todos los alumnos están ocultos. Puedes recuperarlos desde Ocultos.' : t.results.noMatches}</p>
        ) : mode === 'list' ? (
          <div className="student-list grid gap-x-4 gap-y-1 xl:grid-cols-2">
            {rows.map(({ student }) => (
              <StudentRow
                key={student.student_id}
                student={student}
                name={names.get(student.student_id)!}
                onHide={() => hideStudent(student.student_id)}
                onToggle={() => {
                  setOpenStudent(student.student_id)
                  setSelected(null)
                }}
              />
            ))}
          </div>
        ) : (
          <MatrixView
            rows={rows}
            names={names}
            selected={selected}
            onPick={(selection) => {
              setSelected(selection)
              setOpenStudent(selection.studentId)
            }}
            onStudent={setOpenStudent}
            onHide={hideStudent}
          />
        )}

        <PendingPanel artifactPath={artifactPath} />

        <ChainPanel artifactPath={artifactPath} />

        {warnings.length > 0 && (
          <Foldaway
            tone="warning"
            icon={<AlertTriangle className="h-4 w-4 shrink-0" />}
            summary={t.results.warningsFolded(warnings.length)}
          >
            {warnings.map((warning, index) => (
              <p key={index} className="text-xs text-warning-strong/90">
                <span className="font-mono">{warning.scope}</span> · {mask(warning.message)}
              </p>
            ))}
          </Foldaway>
        )}
      </div>
      </ResultsCanvas>
    </div>
  )
}

function ResultsCanvas({ projector, overview, children }: { projector: boolean; overview: ReactNode; children: ReactNode }) {
  return projector ? <>
    <div className="max-h-[40%] shrink-0 overflow-auto px-3 pt-2">{overview}</div>
    <ProjectorCanvas>{children}</ProjectorCanvas>
  </> : <div className="results-scroll min-h-0 flex-1 overflow-auto"><div className="px-3 pt-3 sm:px-4">{overview}</div>{children}</div>
}

/** Class-wide summary, independent of the current exploration filters. */
function KpiStrip({ summary, average, mostFailed }: {
  summary: ClassSummary
  average: number | null
  mostFailed: FailingCheck[]
}) {
  const scale = useScale()
  const hardest = mostFailed[0]
  return (
    <div className="results-summary grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
      <div className="summary-counts flex flex-wrap content-center items-center gap-x-2 gap-y-1 bg-background px-3 py-2 text-sm">
        <span><strong className="tnum">{summary.passed}</strong> aprobados</span>
        <span aria-hidden="true">·</span>
        <span><strong className="tnum">{summary.graded - summary.passed}</strong> suspensos</span>
        <span aria-hidden="true">·</span>
        <span><strong className="tnum">{summary.students - summary.graded}</strong> sin evaluar</span>
      </div>
      <Reading
        value={averageText(average)}
        label={t.results.kpiAverage}
        color={average === null ? 'text-muted-foreground' : 'text-foreground'}
        hint={average === null ? t.results.kpiNoGrades : `Media de ${summary.graded} notas finales · sobre ${scale.max}`}
      />
      <div className="summary-hardest min-w-0 bg-background px-3 py-2">
        <p className="text-micro uppercase tracking-[0.09em] text-muted-foreground">Comprobación con más fallos</p>
        <p className="mt-1 truncate text-sm font-semibold" title={mostFailed.map((check) => `${check.description} (${check.checkId})`).join(' · ')}>
          {hardest ? hardest.description : 'Ninguna comprobación fallada'}
        </p>
        <p className="text-xs text-muted-foreground">
          {hardest ? `${hardest.failed} ${hardest.failed === 1 ? 'fallo' : 'fallos'} de ${hardest.evaluated} evaluados${mostFailed.length > 1 ? ` · ${mostFailed.length} empatadas` : ''}` : 'Las incidencias técnicas no cuentan como fallos'}
        </p>
      </div>
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

function Reading({
  value,
  label,
  hint,
  color
}: {
  value: string
  label: string
  hint: string
  color?: string
}) {
  return (
    <div className="summary-reading flex items-baseline gap-2 bg-background px-3 py-2">
      <span className={cn('text-lg font-semibold tabular-nums', color)}>{value}</span>
      <span className="min-w-0">
        <span className="block text-micro uppercase tracking-[0.09em] text-muted-foreground">
          {label}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </div>
  )
}

/** Compact comparison table; the scroll container owns both sticky axes. */
function MatrixView({ rows, names, selected, onPick, onStudent, onHide }: {
  rows: { student: StudentResult; checks: CheckResult[] }[]
  names: Map<string, string>
  selected: Selection | null
  onPick: (selection: Selection) => void
  onStudent: (id: string) => void
  onHide: (id: string) => void
}) {
  const matrix = useMemo(() => buildMatrix(rows), [rows])
  const [column, setColumn] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend />
        <span className="text-xs text-muted-foreground">Pulsa un nombre para ver su detalle</span>
      </div>
      <div className="matrix-viewport max-h-[65vh] overflow-auto rounded-md border border-border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        role="region" aria-label="Matriz de resultados, desplazamiento horizontal y vertical" tabIndex={0}>
        <table className="results-matrix min-w-full table-fixed border-separate border-spacing-0 text-left"
          style={{ width: `calc(var(--matrix-check-width, clamp(10rem, 38vw, 40rem)) + ${matrix.students.length} * var(--matrix-student-width, 9rem))` }}
          onPointerOver={(event) => setColumn((event.target as HTMLElement).closest<HTMLElement>('[data-column]')?.dataset.column ?? null)}
          onPointerLeave={() => setColumn(null)}
          onFocusCapture={(event) => setColumn(event.target.closest<HTMLElement>('[data-column]')?.dataset.column ?? null)}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setColumn(null) }}>
          <caption className="sr-only">Notas por alumno y comprobaciones superadas por los alumnos visibles</caption>
          <colgroup>
            <col style={{ width: 'var(--matrix-check-width, clamp(10rem, 38vw, 40rem))' }} />
            {matrix.students.map((student) => <col key={student.student_id} style={{ width: 'var(--matrix-student-width, 9rem)' }} />)}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th scope="col" className="sticky left-0 z-30 border-b border-r border-border bg-background px-3 py-3 align-bottom text-xs font-medium text-muted-foreground">
                {t.results.matrixCheck}
                <span className="mt-1 block text-micro font-normal">Superados / alumnos visibles</span>
              </th>
              {matrix.students.map((student) => (
                <th scope="col" key={student.student_id} data-column={student.student_id}
                  className={cn('border-b border-border px-2 py-2 text-center align-top', column === student.student_id ? 'bg-secondary' : 'bg-background')}>
                  <button type="button" className="mx-auto block h-8 max-w-full rounded text-xs font-medium leading-4 underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    title={student.name} aria-label={`Ver detalle de ${student.name}`} onClick={() => onStudent(student.student_id)}>
                    <span className="matrix-student-name line-clamp-2 wrap-break-word">{names.get(student.student_id)}</span>
                  </button>
                  <div className="matrix-student-summary">
                    <MatrixGrade student={student} />
                    <HideStudentButton student={student} onHide={() => onHide(student.student_id)} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => <MatrixRowView key={row.checkId} row={row} students={matrix.students}
              selected={selected} onPick={onPick} column={column} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MatrixGrade({ student }: { student: StudentResult }) {
  const best = useSessionGrade(student)
  const latest = student
  student = best.student
  const scale = useScale()
  const score = scoreView(student.score, scale)
  const appearance = gradeAppearance(student, scale.passMark)
  const label = score.kind === 'provisional' ? 'Provisional' : appearance.label
  return (
    <div className="mt-1.5" role="group" title={`${best.label || label} · ${best.origin || score.note}`}
      aria-label={`${student.name}: ${score.value === null ? 'sin nota' : `${score.text} sobre ${scale.max}`}, ${label}`}>
      <span className={cn('text-xl font-semibold leading-6 tabular-nums', appearance.color)}>
        {score.value === null ? '—' : score.text}
      </span>
      {score.value !== null && <span className="ml-0.5 text-xs font-normal text-muted-foreground">/{scale.max}</span>}
      {best.label && <span className="block text-micro font-normal text-muted-foreground">{best.label}{score.kind === 'final' ? ` · ${best.origin}` : ''}</span>}
      {best.label && <span className="block text-micro font-normal text-muted-foreground">Última: {scoreView(latest.score, scale).text}</span>}
      {!best.label && appearance.tone !== 'pass' && appearance.tone !== 'fail' && (
        <span className={`mt-0.5 block text-micro font-normal ${appearance.color}`}>{label}</span>
      )}
    </div>
  )
}

/**
 * The grade as the teacher reads it first: large, filled with the pass/fail
 * colour, never smaller than the cells around it. An unfinished grade keeps
 * the amber of a technical incident and says «provisional» (principio 3).
 */
function GradeBadge({
  student,
  onClick,
  large = false
}: {
  student: StudentResult
  onClick?: () => void
  large?: boolean
}) {
  const best = useSessionGrade(student)
  student = best.student
  const scale = useScale()
  const score = scoreView(student.score, scale)
  const appearance = gradeAppearance(student, scale.passMark)
  const label = score.kind === 'provisional' ? 'Provisional' : appearance.label
  const body = (
    <>
      <span
        className={cn('block font-bold leading-none tabular-nums', large ? 'text-xl' : 'text-lg')}
      >
        {score.value === null ? '—' : score.text}
      </span>
      {best.label && <span className="mt-1 block text-micro font-normal">{best.label}</span>}
      {!best.label && score.kind === 'provisional' && (
        <span className="mt-0.5 block text-micro font-medium leading-none">provisional</span>
      )}
    </>
  )
  const className = cn(
    'inline-flex flex-col items-center justify-center rounded-md px-2 py-1',
    large ? 'min-w-16' : 'min-w-14',
    appearance.fill
  )
  const title = best.label ? `${best.label} · ${best.origin}` : score.kind === 'final' ? `${label} · ${score.note}` : `${label}: ${score.note}`
  if (!onClick)
    return (
      <span className={className} title={title}>
        {body}
      </span>
    )
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={`${student.name}: ${t.results.matrixScore} ${score.value === null ? '—' : score.text}, ${label}`}
      className={cn(
        className,
        'transition-opacity hover:opacity-85 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      {body}
    </button>
  )
}

function MatrixRowView({
  row,
  students,
  selected,
  onPick,
  column
}: {
  row: MatrixRow
  column: string | null
  students: StudentResult[]
  selected: Selection | null
  onPick: (selection: Selection) => void
}) {
  return (
    <tr className="group hover:bg-secondary/60 focus-within:bg-secondary/60">
      <th
        scope="row"
        className="sticky left-0 z-10 border-b border-r border-border bg-background px-3 py-1.5 text-left text-xs font-normal group-hover:bg-secondary group-focus-within:bg-secondary"
        title={`${row.group} · ${row.description} · peso ${row.weight}`}
      >
        <span className="flex items-center gap-2">
          <span className="case-name min-w-0 flex-1 line-clamp-2 wrap-break-word">{row.description}</span>
          {row.weight !== 1 && <span className="shrink-0 text-muted-foreground">{t.results.matrixWeight(row.weight)}</span>}
          <span className="shrink-0 tabular-nums text-muted-foreground"
            aria-label={`${row.cells.filter((check) => check?.status === 'PASS').length} de ${students.length} alumnos visibles han superado esta comprobación`}>
            {row.cells.filter((check) => check?.status === 'PASS').length}/{students.length}
          </span>
        </span>
      </th>
      {row.cells.map((check, index) => {
        const student = students[index]
        if (!check) {
          return (
            <td key={student.student_id} data-column={student.student_id}
              className={cn('border-b border-border px-1 py-1 text-center', column === student.student_id && 'bg-secondary/70')}>
              <span
                className="inline-block rounded px-1.5 py-0.5 text-glyph text-muted-foreground"
                title={t.results.legendMissing} aria-label={t.results.legendMissing}
              >
                ·
              </span>
            </td>
          )
        }
        const active =
          selected?.studentId === student.student_id && selected.checkId === check.check_id
        return (
          <td key={student.student_id} data-column={student.student_id}
            className={cn('border-b border-border px-1 py-1 text-center', column === student.student_id && 'bg-secondary/70')}>
            <button
              type="button"
              onClick={() => onPick({ studentId: student.student_id, checkId: check.check_id })}
              title={`${student.name} · ${row.description} · ${STATUS_TEXT[check.status]}${check.cause !== 'NONE' ? ` · ${CAUSE_TEXT[check.cause]}` : ''}`}
              aria-label={`${student.name}, ${row.description}: ${STATUS_TEXT[check.status]}`}
              className={cn(
                'inline-flex h-6 w-7 items-center justify-center rounded text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                matrixCellTone(check.status),
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

function matrixCellTone(status: AcademicStatus): string {
  return status === 'PASS' ? 'bg-success/10 text-success-strong' : status === 'FAIL'
    ? 'bg-destructive/10 text-destructive-strong' : 'bg-warning/15 text-warning-strong'
}

/** The three academic states, spelled out once above the grid. */
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {(['PASS', 'FAIL', 'UNEVALUATED'] as const).map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex h-5 w-6 items-center justify-center rounded text-xs font-semibold',
              matrixCellTone(status)
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
  const saved = useBoundExam()
  const artifact = useRun((s) => s.artifact)
  const scale = useScale()
  const setNotice = useApp((s) => s.setNotice)
  const [confirm, setConfirm] = useState(false)

  if (!artifact) return null

  async function save(): Promise<void> {
    setConfirm(false)
    if (!artifact) return
    try {
      const path = await window.heimdall.saveCsv(saved ? savedExamCsvName(saved) : csvName(artifact), saved ? savedExamCsv(saved, scale) : toCsv(artifact, scale))
      setNotice(path ? t.export.saved(path) : t.export.cancelled, path ? 'success' : 'info')
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
          <span className="block">{saved?.session ? sessionExportSummary(saved.session, scale) : saved ? `${saved.record.roster.length} alumnos sin nota final: ninguna vuelta evaluada de estos criterios.` : exportSummary(artifact, scale)}</span>
          <span className="block">{t.export.hint}</span>
          <span className="block text-xs text-muted-foreground">{t.export.scale(scale.label)}</span>
        </span>
      </ConfirmDialog>
    </div>
  )
}

/**
 * Each student's page, left in the home directory of their own machine by the
 * engine (T185, ADR-0031). Never automatic: the teacher presses it, is told
 * what is sent and where, and is then told to whom it arrived and why not.
 */
/** The same grades of this correction, in the file Moodle imports. */
function RunMoodleButton() {
  const saved = useBoundExam()
  const artifact = useRun((s) => s.artifact)
  const scale = useScale()
  if (!artifact) return null
  return <MoodleExportButton rows={saved ? savedExamRows(saved, scale) : gradeRows(artifact, scale)} at={artifact.finished_at} />
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
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive-strong"
        >
          {problem}
        </p>
      )}

      {chain && !problem && <ChainResult chain={chain} />}
    </Foldaway>
  )
}

/** The class as the chain leaves it, student by student. */
function ChainResult({ chain }: { chain: Consolidation }) {
  const projector = useApp((s) => s.projector)
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
        <p className="text-xs text-muted-foreground">
          {t.chain.closed(counts.closed, counts.open)}
        </p>
      </div>

      {!projector && (
        <div className="flex flex-wrap gap-2">
          <ChainExportButton chain={chain} />
          <MoodleExportButton
            rows={chainGradeRows(chain, scale)}
            at={chain.runs[chain.runs.length - 1]?.finished_at ?? ''}
          />
        </div>
      )}

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
                    onClick={() =>
                      setSelected({ studentId: student.student_id, checkId: check.check_id })
                    }
                    title={`${check.check_id} · ${STATUS_TEXT[check.status]} · ${fromRunText(check)}`}
                    aria-label={`${check.check_id}: ${STATUS_TEXT[check.status]}`}
                    className={cn(
                      'max-w-56 truncate rounded px-2 py-1 text-micro font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
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
            check.status === 'PASS'
              ? 'success'
              : check.status === 'FAIL'
                ? 'destructive'
                : 'warning'
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
      setNotice(path ? t.export.saved(path) : t.export.cancelled, path ? 'success' : 'info')
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
  const projector = useApp((s) => s.projector)
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
      void window.heimdall
        .consolidate(artifactPath)
        .then((chain) => {
          if (current) setEffective({ path: artifactPath, chain })
        })
        .catch((error) => {
          if (current) setProblem(messageOf(error))
        })
    }
    return () => {
      current = false
    }
  }, [artifact, artifactPath])
  const source = artifact?.retry_of
    ? effective?.path === artifactPath
      ? effective.chain
      : null
    : artifact
  const pending = useMemo(() => (source ? pendingStudents(source) : []), [source])
  const scope = useMemo(() => (source ? retryScope(source) : null), [source])

  if (problem)
    return (
      <p role="alert" className="text-sm text-destructive-strong">
        {problem}
      </p>
    )
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

      {!projector && (
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
      )}

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

/** A compact row; technical incidents remain distinct from academic failure. */
function HideStudentButton({ student, onHide }: { student: StudentResult; onHide: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onHide} className="h-8 w-8 shrink-0 px-0"
      aria-label={`Ocultar a ${student.name}`} title="Ocultar alumno durante la sesión">
      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  )
}

function StudentRow({ student, name, onToggle, onHide }: {
  student: StudentResult; name: string; onToggle: () => void; onHide: () => void
}) {
  const best = useSessionGrade(student)
  const scale = useScale()
  const projector = useApp((s) => s.projector)
  const counts = tally(student.checks)
  const appearance = gradeAppearance(best.student, scale.passMark)
  const cause = student.checks.find((check) => check.cause !== 'NONE')?.cause
  return (
    <div className="student-row flex items-center gap-1 rounded-md border border-transparent hover:border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Ver detalle: ${student.name}`}
        title={student.name}
        className="student-row-main flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded',
            appearance.tone === 'pass'
              ? 'bg-success text-success-foreground'
              : appearance.tone === 'fail'
                ? 'bg-destructive text-destructive-foreground'
                : appearance.tone === 'neutral'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-warning/15 text-warning-strong'
          )}
          title={appearance.label}
        >
          {appearance.tone === 'pass' ? (
            <Check className="h-4 w-4" />
          ) : appearance.tone === 'fail' ? (
            <X className="h-4 w-4" />
          ) : appearance.tone === 'neutral' ? (
            <span>—</span>
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="student-name block wrap-break-word text-sm font-medium">{name}</span>
          <Meter
            className="mt-1"
            value={counts.pass}
            total={student.checks.length}
            tone={appearance.tone}
          />
          {cause && <span className="block text-micro text-warning-strong">{CAUSE_TEXT[cause]}</span>}
        </span>
        <span className="text-micro text-muted-foreground">
          {counts.pass}/{student.checks.length}
        </span>
        <span className="student-grade flex shrink-0 items-center gap-2">
          <span className={cn('text-xs font-medium', appearance.color)}>{appearance.label}</span>
          <GradeBadge student={student} large />
        </span>
      </button>
      {!projector && <ReportsButton artifactPath={useRun.getState().artifactPath} studentId={student.student_id} compact />}
      <HideStudentButton student={student} onHide={onHide} />
    </div>
  )
}

function StudentDetailView({
  student,
  selected,
  onBack,
  onPick
}: {
  student: StudentResult
  selected: string | null
  onBack: () => void
  onPick: (id: string | null) => void
}) {
  const best = useSessionGrade(student)
  const scale = useScale()
  const score = scoreView(best.student.score, scale)
  const appearance = gradeAppearance(best.student, scale.passMark)
  const counts = tally(student.checks)
  const groups = [...new Set(student.checks.map((check) => check.group))]
  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={
          <span className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            {student.name}
          </span>
        }
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {counts.pass}/{student.checks.length} superadas
            {counts.unevaluated > 0 ? ` · ${counts.unevaluated} sin evaluar` : ''}
          </span>
          <span className={cn('text-right', appearance.color)}>
            <strong className="text-3xl tabular-nums">
              {score.value === null ? '—' : score.text}
            </strong>
            <span className="ml-2 text-sm">
              {best.label || (score.kind === 'provisional' ? 'Provisional' : appearance.label)}
            </span>
          </span>
        </div>
        {best.label && <p className="text-sm text-muted-foreground">{best.origin} · Última vuelta: {scoreView(student.score, scale).text}. Las comprobaciones de abajo muestran la última vuelta.</p>}
        {score.kind !== 'final' && <p className="text-sm text-warning-strong">{score.note}</p>}
        {groups.map((group) => (
          <section key={group} className="space-y-2">
            <h2 className="text-sm font-semibold">{group}</h2>
            {student.checks
              .filter((check) => check.group === group)
              .map((check) => (
                <div key={check.check_id}>
                  <button
                    className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-3 text-left hover:bg-accent"
                    aria-expanded={selected === check.check_id}
                    onClick={() => onPick(selected === check.check_id ? null : check.check_id)}
                  >
                    <span
                      className={cn('rounded px-1.5 text-xs font-semibold', cellTone(check.status))}
                    >
                      {GLYPH[check.status]}
                    </span>
                    <span className="flex-1 text-sm">{check.description || check.check_id}</span>
                    <span className="text-xs text-muted-foreground">
                      {STATUS_TEXT[check.status]} · peso {check.weight}
                    </span>
                  </button>
                  {selected === check.check_id && (
                    <CheckDetail student={student} check={check} onClose={() => onPick(null)} />
                  )}
                </div>
              ))}
          </section>
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
    ? 'bg-success text-success-foreground'
    : status === 'FAIL'
      ? 'bg-destructive text-destructive-foreground'
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
            check.status === 'PASS'
              ? 'success'
              : check.status === 'FAIL'
                ? 'destructive'
                : 'warning'
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
            {check.assertion.evidence_truncated && (
              <span className="text-warning-strong">
                Se muestra un extracto de la evidencia; la comparación se hizo antes de recortarla.
              </span>
            )}
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
            {t.results.exit}: {execution.exit_code ?? '—'} · {t.results.duration}:{' '}
            {execution.duration_ms} ms · {t.results.attempts}: {execution.connect_attempts}/
            {execution.command_attempts}
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
      <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
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

function SessionResultsHint() {
  const saved = useBoundExam()
  if (!saved) return null
  return <p className="shrink-0 border-b border-border px-4 py-1 text-xs text-muted-foreground">
    {saved.record.rounds.length === 0 ? 'Sin nota final: no hay vueltas evaluadas con los criterios actuales. Las comprobaciones visibles pertenecen a criterios anteriores.' : `${saved.record.state === 'FINALIZED' ? 'Nota final: mejor nota alcanzada.' : 'Nota principal: mejor nota completa alcanzada.'} Comprobaciones y resultados actuales: última vuelta.`}
  </p>
}
