import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, GraduationCap, Layers, Play, Radio, Square } from 'lucide-react'
import {
  Badge,
  Button,
  ConfirmDialog,
  Meter,
  ProgressBar,
  SectionTitle,
  Segmented,
  SegmentedItem,
  ViewHeader
} from '@/components/ui'
import { useApp, useScale, messageOf, noticeFrom } from '@/stores/app'
import { useClasses, groupById } from '@/stores/classes'
import type { ClassGroup } from '../../../shared/classes'
import { useRun } from '@/stores/run'
import { runPercent, type StudentProgress } from '@/lib/run-state'
import { EXAM_INTERVALS, type ExamMode } from '@/lib/exam'
import {
  SESSION_STATUS_TEXT,
  fromRoundText,
  nextRoundText,
  roundLines,
  sessionTally,
  sessionText
} from '@/lib/session'
import { scoreView } from '@/lib/results'

import { sessionCsv, sessionCsvName, sessionExportSummary, sessionGradeRows } from '@/lib/export'
import { MoodleExportButton } from '@/components/MoodleExport'
import { CorrectionClock } from '@/components/CorrectionClock'
import { FinishExamButton } from '@/components/ExamSession'
import { useExamRecord } from '@/stores/exam-record'
import { pauseExam, resumeExam } from '@/lib/exam-actions'
import { startCorrection } from '@/lib/start-run'
import type { Session } from '../../../shared/session'
import type { Description } from '../../../shared/describe'
import { t } from '@/i18n/es'

/**
 * Corregir: the exam already open, the class chosen and the button.
 *
 * This is the screen used with the class in the room, so everything a
 * correction needs is here and nothing else: which exam, which class, the
 * credentials for this run and what is going on. No file is asked for — the
 * classroom the engine reads is written from the class (ADR-0022).
 */
export default function CorrectView() {
  const examPath = useApp((s) => s.project?.examPath ?? null)
  const engine = useApp((s) => s.engine)
  const setNotice = useApp((s) => s.setNotice)
  const setView = useApp((s) => s.setView)
  const classId = useApp((s) => s.classId)
  const setClassId = useApp((s) => s.setClassId)
  const retry = useApp((s) => s.retry)
  const setRetry = useApp((s) => s.setRetry)
  const exam = useApp((s) => s.exam)
  const finishing = useExamRecord(s => s.finishing)
  const recordState = useExamRecord(s => s.saved?.record.state)

  const run = useRun()
  const busy = run.phase === 'starting' || run.phase === 'running'

  const groups = useClasses((s) => s.groups)
  const classesLoaded = useClasses((s) => s.loaded)
  const loadClasses = useClasses((s) => s.load)
  useEffect(() => {
    if (!classesLoaded) void loadClasses()
  }, [classesLoaded, loadClasses])
  const group = groupById(groups, classId)

  /** What the open exam is called, for the screen. */
  const [described, setDescribed] = useState<Description>({ exam: null })

  useEffect(() => {
    if (!examPath) {
      setDescribed({ exam: null })
      return
    }
    let current = true
    window.heimdall
      .describe({ examPath })
      .then((description) => {
        if (current) setDescribed(description)
      })
      // A name is for reading: if it cannot be read the path is still there,
      // and the file's real error arrives whole when the engine reads it.
      .catch(() => {
        if (current) setDescribed({ exam: null })
      })
    return () => {
      current = false
    }
  }, [examPath])

  /**
   * Credential names this class's classroom asks for. They are asked of the
   * main process, which reads them off the very text the correction will
   * write. The value is the class's own password and goes to the engine
   * through stdin, nowhere else (ADR-0009, ADR-0030).
   */
  const [refs, setRefs] = useState<string[]>([])
  const [confirmStop, setConfirmStop] = useState(false)

  useEffect(() => {
    if (!group) {
      setRefs([])
      return
    }
    let current = true
    window.heimdall
      .secretRefs(group.id)
      .then((names) => {
        if (current) setRefs(names)
      })
      .catch((error) => setNotice(noticeFrom('No se pudo leer la clase', error)))
    return () => {
      current = false
    }
  }, [group, setNotice])

  /**
   * The envelope the engine reads: the same value for every credential the
   * generated classroom asks for: the password saved with the class
   * (ADR-0030).
   */
  function envelope(): Record<string, string> {
    return Object.fromEntries(refs.map((name) => [name, group?.password ?? '']))
  }

  const missing = !engine?.found
    ? t.run.needEngine
    : !examPath
      ? t.run.needExam
      : !group
        ? t.run.needClass
        : refs.length > 0 && !group.password
          ? t.run.needSecrets
          : null

  async function start(): Promise<void> {
    if (missing) return
    await startCorrection(envelope())
  }

  /**
   * Exam mode. The credentials are handed to the main process once, and the
   * first pass is launched by the same timer that chains the rest: there is
   * one way in, so there is one place where two engines could be started and
   * it already refuses to.
   */
  async function startExamMode(minutes: number): Promise<void> {
    if (!missing) await resumeExam(minutes)
  }

  async function stop(): Promise<void> {
    setConfirmStop(false)
    useRun.getState().cancelRequested()
    try {
      await window.heimdall.cancelRun()
    } catch (error) {
      setNotice(noticeFrom('No se pudo detener la corrección', error))
    }
  }

  const percent = runPercent(run)
  const examSession = useExamSession()

  return (
    <div className="correct-view flex h-full flex-col">
      <ViewHeader
        title={t.correct.title}
        meta={groups.length > 0 ? <label className="class-selector">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          <select aria-label={t.correct.classPick} disabled={busy || exam.active}
            value={group?.id ?? ''} onChange={event => setClassId(event.target.value || null)}>
            <option value="">{classId && !group ? t.correct.classGone : t.correct.classNone}</option>
            {groups.map(other => <option key={other.id} value={other.id}>{other.name}</option>)}
          </select>
        </label> : <Button size="sm" variant="outline" onClick={() => setView('classes')}>{t.correct.goToClasses}</Button>}
        actions={
          busy ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={run.cancelling}
              onClick={() => setConfirmStop(true)}
            >
              <Square className="h-4 w-4" />
              {run.cancelling ? t.run.cancelling : t.run.cancel}
            </Button>
          ) : (
            <Button size="sm" disabled={!!missing || exam.active || finishing} onClick={() => void start()}>
              <Play className="h-4 w-4" />
              {retry ? t.run.retryStart : run.phase === 'finished' ? t.run.again : t.run.start}
            </Button>
          )
        }
      />
      <div className="correct-content min-h-0 flex-1 space-y-3 overflow-auto p-4">
        <div className="correct-context flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
          {examPath ? <span className="truncate" title={described.exam?.name ?? examPath}>
            {described.exam?.name ?? t.home.unnamed}
            {described.exam?.checks != null && ` · ${t.home.examMeta(described.exam.checks)}`}
          </span> : <Button variant="outline" size="sm" onClick={() => setView('home')}>{t.correct.goHome}</Button>}
        </div>

        {/* A retry is never silent: it says what it will repeat and it can be
            called off without leaving this screen. */}
        {retry && (
          <div className="space-y-2 rounded-md bg-warning/10 p-4">
            <p className="text-sm font-medium text-warning-strong">{t.run.retryTitle}</p>
            <p className="text-xs text-warning-strong/90">
              {t.run.retryBody(retry.checks, retry.students)}
            </p>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRetry(null)}>
              {t.run.retryCancel}
            </Button>
          </div>
        )}

        {missing && !busy && <p className="text-sm text-muted-foreground">{missing}</p>}
        <ExamControl
          exam={exam}
          disabled={busy || !!missing || finishing}
          onStart={(minutes) => void startExamMode(minutes)}
          onStop={() => void pauseExam()}
        />
        {group && !exam.active && run.phase === 'idle' && <PendingStudents group={group} />}

        {run.phase !== 'idle' && <RunPanel percent={percent} />}

        {exam.active && !examSession.session && run.students.length === 0 && group && <PendingStudents group={group} />}
        {recordState !== 'FINALIZED' && examSession.problem && <p role="alert" className="text-sm text-destructive-strong">{examSession.problem}</p>}
        {recordState !== 'FINALIZED' && examSession.rounds.length > 0 && <details className="session-details">
          <summary className="cursor-pointer py-2 text-sm text-muted-foreground">Detalle de la sesión</summary>
          <SessionPanel {...examSession} />
        </details>}
      </div>

      <ConfirmDialog
        open={confirmStop}
        title={t.run.confirmTitle}
        confirmLabel={t.run.confirmYes}
        destructive
        onConfirm={() => void stop()}
        onCancel={() => setConfirmStop(false)}
      >
        {t.run.confirmBody}
      </ConfirmDialog>
    </div>
  )
}

/**
 * Exam mode, as two buttons and an interval. It lives next to «Corregir»
 * because both are the same decision —correct now, or keep correcting— and
 * the teacher takes it once, with the class already in the room.
 */
function ExamControl({
  exam,
  disabled,
  onStart,
  onStop
}: {
  exam: ExamMode
  disabled: boolean
  onStart: (minutes: number) => void
  onStop: () => void
}) {
  const [minutes, setMinutes] = useState<number>(exam.everyMinutes)
  const paused = useExamRecord(s => s.saved?.record.state === 'PAUSED')
  const changing = useExamRecord(s => s.changing)

  return <section className={`exam-control ${exam.active ? 'exam-control-active' : ''}`} aria-label="Modo examen">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Radio className="h-5 w-5 text-primary" />Modo examen</h2>
      {(exam.active || paused) && <div className="ml-auto"><CorrectionClock /></div>}
    </div>
    {!exam.active && <>
      <p className="mt-1 text-sm text-muted-foreground">Corrige automáticamente y conserva la mejor nota completa de cada alumno.</p>
      <div className="exam-interval my-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Intervalo</span>
        <Segmented aria-label="Intervalo entre correcciones">
          {EXAM_INTERVALS.map(value => <SegmentedItem key={value} active={value === minutes}
            disabled={disabled} onClick={() => setMinutes(value)}>{value} min</SegmentedItem>)}
        </Segmented>
      </div>
    </>}
    <div className="exam-control-actions mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className={!exam.active ? 'exam-start w-full' : undefined}
        disabled={changing || (!exam.active && disabled)}
        onClick={() => exam.active ? onStop() : onStart(minutes)}>
        <Radio className="h-4 w-4" />{exam.active ? 'Pausar' : paused ? 'Reanudar' : 'Iniciar modo examen'}
      </Button>
      <FinishExamButton />
    </div>
  </section>
}

/** The roster is visible before the first correction, just as in Teuton GUI. */
function PendingStudents({ group }: { group: ClassGroup }) {
  return (
    <section className="space-y-2">
      <SectionTitle>
        Alumnos a evaluar{' '}
        <span className="ml-3 font-normal text-muted-foreground">Toda la clase · {group.students.length}</span>
      </SectionTitle>
      <div className="pending-students grid gap-1.5">
        {group.students.map((student, index) => (
          <div
            key={student.id}
            className="pending-student flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
          >
            <span className="text-xs text-muted-foreground">{index + 1}</span>
            {student.name}
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * The exam as a whole: what each student's grade is worth right now, which
 * round it comes from and who has already finished.
 *
 * It is read after every round, from the engine, with the rounds of this exam
 * and nothing else. Not a single number on this panel was worked out here: the
 * best round, the state and the grade are the engine's (ADR-0020, principio
 * 12), and while a round is running the previous answer stays on screen
 * instead of a blank.
 */
function useExamSession(): {
  rounds: string[]
  session: Session | null
  problem: string | null
  loading: boolean
} {
  const rounds = useApp((s) => s.examRounds)
  const [session, setSession] = useState<Session | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const read = useCallback(async (paths: string[]): Promise<void> => {
    if (paths.length === 0) {
      setSession(null)
      setProblem(null)
      return
    }
    setLoading(true)
    try {
      setSession(await window.heimdall.session(paths))
      setProblem(null)
    } catch (error) {
      setProblem(t.session.refused(messageOf(error)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void read(rounds)
  }, [rounds, read])

  return { rounds, session, problem, loading }
}

/**
 * Optional session evidence, folded while the teacher operates the correction.
 * Loading errors are also surfaced outside this panel by the parent.
 */
function SessionPanel({
  rounds,
  session,
  problem,
  loading
}: {
  rounds: string[]
  session: Session | null
  problem: string | null
  loading: boolean
}) {
  const scale = useScale()
  if (rounds.length === 0) return null

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Layers className="h-4 w-4" />
        {t.session.title}
      </div>
      <p className="max-w-3xl text-xs text-muted-foreground">{t.session.hint}</p>

      {loading && <p className="text-xs text-muted-foreground">{t.session.loading}</p>}

      {problem && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive-strong"
        >
          {problem}
        </p>
      )}

      {session && !problem && (
        <>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{sessionText(session)}</p>
            <p className="text-xs text-muted-foreground">
              {t.session.tally(
                sessionTally(session).graded,
                sessionTally(session).finished,
                sessionTally(session).open
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <SessionExportButton session={session} />
            <SessionMoodleButton session={session} />
          </div>

          <div className="space-y-2">
            {session.students.map((student) => {
              const score = scoreView(student.score, scale)
              const next = nextRoundText(student)
              return (
                <div
                  key={student.student_id}
                  className="space-y-1 rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{student.name}</span>
                      <Badge
                        variant={
                          student.status === 'FINISHED'
                            ? 'success'
                            : student.status === 'EXCLUDED'
                              ? 'outline'
                              : undefined
                        }
                      >
                        {SESSION_STATUS_TEXT[student.status]}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      {student.from_round === 0 ? (
                        <span className="text-sm text-muted-foreground">{t.results.noGrade}</span>
                      ) : (
                        <span className="text-lg font-semibold tabular-nums">{score.text}</span>
                      )}
                      <span className="text-micro text-muted-foreground">
                        {fromRoundText(student)}
                      </span>
                    </div>
                  </div>
                  {next && <p className="text-xs text-muted-foreground">{next}</p>}
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      {t.session.rounds}
                    </summary>
                    <div className="mt-1 space-y-0.5">
                      {roundLines(student, scale).map((line, index) => (
                        <p key={index} className="text-micro text-muted-foreground">
                          {line}
                        </p>
                      ))}
                    </div>
                  </details>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** The session's grades, in the file Moodle imports. */
function SessionMoodleButton({ session }: { session: Session }) {
  const scale = useScale()
  return (
    <MoodleExportButton
      rows={sessionGradeRows(session, scale)}
      at={session.rounds[session.rounds.length - 1]?.finished_at ?? ''}
    />
  )
}

/** The session's grades, out of the application, with the engine's numbers. */
function SessionExportButton({ session }: { session: Session }) {
  const scale = useScale()
  const setNotice = useApp((s) => s.setNotice)
  const [confirm, setConfirm] = useState(false)

  async function save(): Promise<void> {
    setConfirm(false)
    try {
      const path = await window.heimdall.saveCsv(
        sessionCsvName(session),
        sessionCsv(session, scale)
      )
      setNotice(path ? t.export.saved(path) : t.export.cancelled, path ? 'success' : 'info')
    } catch (error) {
      setNotice(noticeFrom(t.export.failed, error))
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
        <Download className="h-4 w-4" />
        {t.session.export}
      </Button>
      <ConfirmDialog
        open={confirm}
        title={t.session.exportTitle}
        confirmLabel={t.export.yes}
        onConfirm={() => void save()}
        onCancel={() => setConfirm(false)}
      >
        <span className="space-y-2 block">
          <span className="block">{sessionExportSummary(session, scale)}</span>
          <span className="block">{t.session.exportHint}</span>
          <span className="block text-xs text-muted-foreground">{t.export.scale(scale.label)}</span>
        </span>
      </ConfirmDialog>
    </div>
  )
}

/** What is happening, and what happened. The grades are in Resultados. */
function RunPanel({ percent }: { percent: number | null }) {
  const run = useRun()
  const expected = run.start?.expected_checks ?? 0

  return (
    <div className="space-y-4">
      <ProgressBar
        percent={percent}
        label={expected > 0 ? t.run.progress(run.done, expected) : t.run.starting}
      />

      {run.problem && (
        <p
          role="alert"
          className="whitespace-pre-wrap rounded-md bg-destructive/10 p-3 text-sm text-destructive-strong"
        >
          {run.problem}
        </p>
      )}

      {run.end && (
        <div className="space-y-1 text-sm">
          <p>{t.run.status[run.end.status]}</p>
          <p className="text-xs text-muted-foreground">{t.run.resultsPending}</p>
        </div>
      )}

      {run.students.length > 0 && (
        <div className="space-y-2">
          <SectionTitle>{t.run.classTitle}</SectionTitle>
          <div className="running-students grid gap-2 md:grid-cols-3">
            {run.students.map((student) => (
              <StudentRow
                key={student.studentId}
                student={student}
                checks={run.start?.plan.check_count ?? 0}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StudentRow({ student, checks }: { student: StudentProgress; checks: number }) {
  const label = student.excluded
    ? t.run.excluded
    : student.status
      ? t.run.student[student.status]
      : student.done > 0
        ? t.run.inProgress
        : t.run.waiting

  // Green only when the student ended with everything evaluated. Nothing here
  // is ever red: a check left unevaluated is a technical problem, not a fail
  // (principio 3), and a red bar in front of the class says the opposite.
  const tone = student.status === 'OK' ? 'pass' : 'neutral'
  const badge =
    student.status === 'OK'
      ? 'success'
      : student.status === 'NOT_EVALUATED' || student.status === 'PARTIAL'
        ? 'warning'
        : student.status === 'EXCLUDED' || student.excluded
          ? 'outline'
          : undefined

  return (
    <div className="space-y-1 rounded-md border border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 wrap-break-word text-sm font-medium">{student.name}</span>
        <Badge variant={badge}>{label}</Badge>
      </div>
      {!student.excluded && (
        <>
          <Meter value={student.done} total={checks} tone={tone} />
        </>
      )}
    </div>
  )
}
