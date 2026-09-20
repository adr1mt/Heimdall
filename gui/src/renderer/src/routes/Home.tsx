import { useEffect, useState } from 'react'
import { FileText, Play, RotateCcw, Square, Timer, Users } from 'lucide-react'
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
import { useApp, noticeFrom } from '@/stores/app'
import { useRun } from '@/stores/run'
import { runPercent, type StudentProgress } from '@/lib/run-state'
import { EXAM_INTERVALS, secondsLeft, type ExamMode } from '@/lib/exam'
import { startCorrection } from '@/lib/start-run'
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
