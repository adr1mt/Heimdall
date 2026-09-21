import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Layers, Play, RotateCcw, Square, Timer, Users } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Input,
  Meter,
  ProgressBar,
  SectionTitle,
  ViewHeader
} from '@/components/ui'
import { useApp, messageOf, noticeFrom } from '@/stores/app'
import { useRun } from '@/stores/run'
import { runPercent, type StudentProgress } from '@/lib/run-state'
import { EXAM_INTERVALS, secondsLeft, type ExamMode } from '@/lib/exam'
import {
  SESSION_STATUS_TEXT,
  fromRoundText,
  nextRoundText,
  roundLines,
  sessionTally,
  sessionText
} from '@/lib/session'
import { scoreView } from '@/lib/results'
import { scaleOf, sessionCsv, sessionCsvName, sessionExportSummary } from '@/lib/export'
import { startCorrection } from '@/lib/start-run'
import type { Session } from '../../../shared/session'
import { t } from '@/i18n/es'

export default function HomeView() {
  const examPath = useApp((s) => s.examPath)
  const classPath = useApp((s) => s.classPath)
  const engine = useApp((s) => s.engine)
  const setExamPath = useApp((s) => s.setExamPath)
  const setClassPath = useApp((s) => s.setClassPath)
  const setNotice = useApp((s) => s.setNotice)
  const retry = useApp((s) => s.retry)
  const setRetry = useApp((s) => s.setRetry)
  const exam = useApp((s) => s.exam)

  const run = useRun()
  const busy = run.phase === 'starting' || run.phase === 'running'

  /** Credential names the classroom asks for, and what the teacher typed. */
  const [refs, setRefs] = useState<string[]>([])
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [confirmStop, setConfirmStop] = useState(false)

  useEffect(() => {
    if (!classPath) {
      setRefs([])
      setSecrets({})
      return
    }
    let current = true
    window.heimdall
      .secretRefs(classPath)
      .then((names) => {
        if (!current) return
        setRefs(names)
        setSecrets({})
      })
      .catch((error) => setNotice(noticeFrom('No se pudo leer el aula', error)))
    return () => {
      current = false
    }
  }, [classPath, setNotice])

  async function pick(kind: 'exam' | 'class'): Promise<void> {
    try {
      const picked = await window.heimdall.pickFile(kind)
      if (!picked) return
      if (kind === 'exam') setExamPath(picked)
      else setClassPath(picked)
    } catch (error) {
      setNotice(noticeFrom('No se pudo abrir el fichero', error))
    }
  }

  const missing = !engine?.found
    ? t.run.needEngine
    : !examPath || !classPath
      ? t.run.needFiles
      : refs.some((name) => !secrets[name])
        ? t.run.needSecrets
        : null

  async function start(): Promise<void> {
    if (missing) return
    await startCorrection(secrets)
    // The values leave the interface as soon as the engine has them.
    setSecrets({})
  }

  /**
   * Exam mode. The credentials are handed to the main process once, and the
   * first pass is launched by the same timer that chains the rest: there is
   * one way in, so there is one place where two engines could be started and
   * it already refuses to.
   */
  async function startExamMode(minutes: number): Promise<void> {
    if (missing) return
    try {
      await window.heimdall.setExamMode({ active: true, secrets })
    } catch (error) {
      setNotice(noticeFrom('No se pudo activar el modo examen', error))
      return
    }
    setSecrets({})
    setRetry(null)
    useApp.getState().startExam(minutes)
  }

  async function stopExamMode(): Promise<void> {
    useApp.getState().stopExam()
    try {
      await window.heimdall.setExamMode({ active: false })
    } catch (error) {
      setNotice(noticeFrom('No se pudo desactivar el modo examen', error))
    }
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

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t.home.title} />
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FileCard
            icon={<FileText className="h-4 w-4" />}
            title={t.home.exam}
            hint={t.home.examHint}
            path={examPath}
            disabled={busy}
            onPick={() => void pick('exam')}
          />
          <FileCard
            icon={<Users className="h-4 w-4" />}
            title={t.home.classroom}
            hint={t.home.classHint}
            path={classPath}
            disabled={busy}
            onPick={() => void pick('class')}
          />
        </div>
        <p className="max-w-3xl text-xs text-muted-foreground">{t.home.sameFolder}</p>

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

        {classPath && (
          <Card>
            <CardHeader>
              <CardTitle>{t.credentials.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {refs.length > 0 ? t.credentials.hint : t.credentials.none}
              </p>
              {refs.map((name) => (
                <label key={name} className="flex items-center gap-3">
                  <span className="w-56 shrink-0 truncate font-mono text-dense">{name}</span>
                  <Input
                    type="password"
                    autoComplete="off"
                    disabled={busy}
                    placeholder={t.credentials.placeholder}
                    value={secrets[name] ?? ''}
                    onChange={(e) => setSecrets((prev) => ({ ...prev, [name]: e.target.value }))}
                  />
                </label>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-3">
          {busy ? (
            <Button variant="destructive" disabled={run.cancelling} onClick={() => setConfirmStop(true)}>
              <Square className="h-4 w-4" />
              {run.cancelling ? t.run.cancelling : t.run.cancel}
            </Button>
          ) : (
            <Button disabled={!!missing} onClick={() => void start()}>
              {retry ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {retry ? t.run.retryStart : run.phase === 'finished' ? t.run.again : t.run.start}
            </Button>
          )}
          {missing && !busy && <span className="text-xs text-muted-foreground">{missing}</span>}
        </div>

        <ExamCard
          exam={exam}
          disabled={!!missing && !exam.active}
          onStart={(minutes) => void startExamMode(minutes)}
          onStop={() => void stopExamMode()}
        />

        <SessionPanel />

        {run.phase !== 'idle' && <RunPanel percent={percent} />}
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
 * Exam mode: the class is corrected again and again while the practice lasts.
 *
 * The countdown is shown because the teacher has to know whether what is on
 * the screen is from a minute ago or from twenty, and because it is the only
 * visible sign that the mode is still on between two passes.
 */
function ExamCard({
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
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!exam.active) {
      setLeft(null)
      return
    }
    const tick = (): void => setLeft(secondsLeft(exam, Date.now()))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [exam])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-4 w-4" />
          {t.exam.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t.exam.hint}</p>
        {exam.active ? (
          <>
            <p className="text-sm">
              {t.exam.running(exam.passes, exam.everyMinutes)}{' '}
              {left === null ? t.exam.correcting : t.exam.nextIn(left)}
            </p>
            <Button variant="outline" size="sm" onClick={onStop}>
              {t.exam.stop}
            </Button>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {EXAM_INTERVALS.map((value) => (
              <Button
                key={value}
                variant={value === minutes ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMinutes(value)}
              >
                {t.exam.everyMinutes(value)}
              </Button>
            ))}
            <Button disabled={disabled} onClick={() => onStart(minutes)}>
              {t.exam.start}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
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
function SessionPanel() {
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
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive-strong">
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

          <SessionExportButton session={session} />

          <div className="space-y-2">
            {session.students.map((student) => {
              const score = scoreView(student.score)
              const next = nextRoundText(student)
              return (
                <div key={student.student_id} className="space-y-1 rounded-md border border-border p-3">
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
                        <span className="text-lg font-semibold tabular-nums">{score.value}</span>
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
                      {roundLines(student).map((line, index) => (
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

/** The session's grades, out of the application, with the engine's numbers. */
function SessionExportButton({ session }: { session: Session }) {
  const scaleId = useApp((s) => s.scale)
  const setNotice = useApp((s) => s.setNotice)
  const [confirm, setConfirm] = useState(false)
  const scale = scaleOf(scaleId)

  async function save(): Promise<void> {
    setConfirm(false)
    try {
      const path = await window.heimdall.saveCsv(sessionCsvName(session), sessionCsv(session, scale))
      setNotice(path ? t.export.saved(path) : t.export.cancelled)
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
        <p role="alert" className="whitespace-pre-wrap rounded-md bg-destructive/10 p-3 text-sm text-destructive-strong">
          {run.problem}
        </p>
      )}

      {run.end && (
        <div className="space-y-1 text-sm">
          <p>{t.run.status[run.end.status]}</p>
          {run.end.artifact && (
            <p className="truncate font-mono text-dense text-muted-foreground" title={run.end.artifact}>
              {t.run.artifact} {run.end.artifact}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t.run.resultsPending}</p>
        </div>
      )}

      {run.students.length > 0 && (
        <div className="space-y-2">
          <SectionTitle>{t.run.classTitle}</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
            {run.students.map((student) => (
              <StudentRow key={student.studentId} student={student} checks={run.start?.plan.check_count ?? 0} />
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
    <div className="space-y-1.5 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{student.name}</span>
        <Badge variant={badge}>{label}</Badge>
      </div>
      {!student.excluded && (
        <>
          <Meter value={student.done} total={checks} tone={tone} />
          <p className="text-micro text-muted-foreground">
            {t.run.counts(student.pass, student.fail, student.unevaluated)}
          </p>
        </>
      )}
    </div>
  )
}

function FileCard({
  icon,
  title,
  hint,
  path,
  disabled,
  onPick
}: {
  icon: React.ReactNode
  title: string
  hint: string
  path: string | null
  disabled: boolean
  onPick: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{hint}</p>
        <p className="truncate font-mono text-dense" title={path ?? undefined}>
          {path ?? <span className="text-muted-foreground">{t.home.none}</span>}
        </p>
        <Button variant="outline" size="sm" disabled={disabled} onClick={onPick}>
          {t.home.choose}
        </Button>
      </CardContent>
    </Card>
  )
}
