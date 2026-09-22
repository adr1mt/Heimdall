import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Layers, Play, RotateCcw, Square, Timer, Users } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  Input,
  Meter,
  ProgressBar,
  SectionTitle,
  Segmented,
  SegmentedItem,
  ViewHeader
} from '@/components/ui'
import { useApp, useScale, messageOf, noticeFrom } from '@/stores/app'
import { useClasses, groupById } from '@/stores/classes'
import { groupLine, type ClassGroup } from '../../../shared/classes'
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

import {
  sessionCsv,
  sessionCsvName,
  sessionExportSummary,
  sessionGradeRows
} from '@/lib/export'
import { MoodleExportButton } from '@/components/MoodleExport'
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
   * Credential names this class's classroom asks for, and what the teacher
   * typed. They are asked of the main process, which reads them off the very
   * text the correction will write, and the values never leave this screen
   * except towards the engine (ADR-0009).
   */
  const [refs, setRefs] = useState<string[]>([])
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [confirmStop, setConfirmStop] = useState(false)

  useEffect(() => {
    if (!group) {
      setRefs([])
      setSecrets({})
      return
    }
    let current = true
    window.heimdall
      .secretRefs(group.id)
      .then((names) => {
        if (!current) return
        setRefs(names)
        setSecrets({})
      })
      .catch((error) => setNotice(noticeFrom('No se pudo leer la clase', error)))
    return () => {
      current = false
    }
  }, [group, setNotice])

  const missing = !engine?.found
    ? t.run.needEngine
    : !examPath
      ? t.run.needExam
      : !group
        ? t.run.needClass
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
  const examSession = useExamSession()

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t.correct.title} />
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-6">
        <p className="max-w-3xl text-sm text-muted-foreground">{t.correct.hint}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <ExamCard
            name={examPath ? (described.exam?.name ?? t.home.unnamed) : null}
            meta={described.exam?.checks == null ? null : t.home.examMeta(described.exam.checks)}
            onOpen={() => setView('home')}
          />
          <ClassCard
            group={group}
            groups={groups}
            missingClass={classId !== null && group === null}
            disabled={busy}
            onChoose={setClassId}
            onGoToClasses={() => setView('classes')}
          />
        </div>

        {group && <Credentials refs={refs} secrets={secrets} disabled={busy} onSecret={(name, value) => setSecrets((prev) => ({ ...prev, [name]: value }))} />}

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

        <div>
          <SectionTitle>{t.correct.action}</SectionTitle>
          <div className="flex flex-wrap items-center gap-3">
            {busy ? (
              <Button
                variant="destructive"
                disabled={run.cancelling}
                onClick={() => setConfirmStop(true)}
              >
                <Square className="h-4 w-4" />
                {run.cancelling ? t.run.cancelling : t.run.cancel}
              </Button>
            ) : (
              <Button disabled={!!missing} onClick={() => void start()}>
                {retry ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {retry ? t.run.retryStart : run.phase === 'finished' ? t.run.again : t.run.start}
              </Button>
            )}
            <ExamControl
              exam={exam}
              disabled={!!missing && !exam.active}
              onStart={(minutes) => void startExamMode(minutes)}
              onStop={() => void stopExamMode()}
            />
            {missing && !busy && <span className="text-xs text-muted-foreground">{missing}</span>}
          </div>
          {exam.active && <p className="mt-2 text-xs text-muted-foreground">{t.exam.hint}</p>}
        </div>

        {exam.active && (
          <ExamStrip exam={exam} percent={percent} session={examSession.session} />
        )}

        <SessionPanel {...examSession} />

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

/** The exam being corrected, by its name. It is opened in Inicio. */
function ExamCard({
  name,
  meta,
  onOpen
}: {
  name: string | null
  meta: string | null
  onOpen: () => void
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center gap-2 text-micro uppercase tracking-[0.09em] text-muted-foreground">
          <FileText className="h-4 w-4" />
          {t.correct.exam}
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-name font-semibold">
              {name ?? <span className="text-muted-foreground">{t.correct.examNone}</span>}
            </p>
            {name && meta && <p className="text-xs text-muted-foreground">{meta}</p>}
          </div>
          {!name && (
            <Button variant="outline" size="sm" onClick={onOpen}>
              {t.correct.goHome}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * The class being corrected, by its name.
 *
 * What the teacher recognises is «2SMX A · 15 alumnos», and that is all there
 * is to choose: the classroom the engine reads is written from this class
 * before every correction and never appears on screen (ADR-0022).
 */
function ClassCard({
  group,
  groups,
  missingClass,
  disabled,
  onChoose,
  onGoToClasses
}: {
  group: ClassGroup | null
  groups: ClassGroup[]
  /** A class was chosen and is no longer there. */
  missingClass: boolean
  disabled: boolean
  onChoose: (id: string | null) => void
  onGoToClasses: () => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-2 text-micro uppercase tracking-[0.09em] text-muted-foreground">
          <Users className="h-4 w-4" />
          {t.correct.classroom}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-name font-semibold">
            {group ? (
              groupLine(group)
            ) : (
              <span className="text-muted-foreground">
                {missingClass ? t.correct.classGone : t.correct.classNone}
              </span>
            )}
          </p>
          {groups.length === 0 ? (
            <Button variant="outline" size="sm" onClick={onGoToClasses}>
              {t.correct.goToClasses}
            </Button>
          ) : (
            <select
              aria-label={t.correct.classPick}
              disabled={disabled}
              value={group?.id ?? ''}
              onChange={(e) => onChoose(e.target.value || null)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">{t.correct.classNone}</option>
              {groups.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {groups.length === 0 && (
          <p className="text-xs text-muted-foreground">{t.correct.classEmpty}</p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * The credentials of this run. They are typed here, they travel to the engine
 * through stdin and they are written nowhere: not in the class, not in the
 * classroom, not in the artifact (ADR-0009).
 */
function Credentials({
  refs,
  secrets,
  disabled,
  onSecret
}: {
  refs: string[]
  secrets: Record<string, string>
  disabled: boolean
  onSecret: (name: string, value: string) => void
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-4">
      <p className="text-micro uppercase tracking-[0.09em] text-muted-foreground">
        {t.credentials.title}
      </p>
      <p className="text-xs text-muted-foreground">
        {refs.length > 0 ? t.credentials.hint : t.credentials.none}
      </p>
      {refs.map((name) => (
        <label key={name} className="flex items-center gap-3">
          <span className="w-56 shrink-0 truncate font-mono text-dense">{name}</span>
          <Input
            type="password"
            autoComplete="off"
            disabled={disabled}
            placeholder={t.credentials.placeholder}
            value={secrets[name] ?? ''}
            onChange={(e) => onSecret(name, e.target.value)}
          />
        </label>
      ))}
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

  if (exam.active) {
    return (
      <Button variant="outline" onClick={onStop}>
        <Timer className="h-4 w-4" />
        {t.exam.stop}
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled={disabled} onClick={() => onStart(minutes)}>
        <Timer className="h-4 w-4" />
        {t.exam.start}
      </Button>
      <Segmented>
        {EXAM_INTERVALS.map((value) => (
          <SegmentedItem key={value} active={value === minutes} onClick={() => setMinutes(value)}>
            {t.exam.everyMinutes(value)}
          </SegmentedItem>
        ))}
      </Segmented>
    </div>
  )
}

/**
 * What is going on while the exam lasts, in the five readings that answer it
 * without opening anything: which round this is, how long until the next one,
 * how many students are still being corrected, how many have finished and how
 * far the round in flight has got.
 *
 * The countdown is what says the mode is still on between two rounds; the
 * finished ones are the engine's word (ADR-0020), never counted here.
 */
function ExamStrip({
  exam,
  percent,
  session
}: {
  exam: ExamMode
  percent: number | null
  session: Session | null
}) {
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const tick = (): void => setLeft(secondsLeft(exam, Date.now()))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [exam])

  const tally = session ? sessionTally(session) : null
  const active = tally ? tally.graded + tally.open - tally.finished : null

  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-5">
      <Reading value={String(exam.passes)} label={t.exam.roundLabel} hint={t.exam.ofMinutes(exam.everyMinutes)} />
      <Reading
        value={left === null ? t.exam.nowCorrecting : left >= 60 ? `${Math.ceil(left / 60)} min` : `${left} s`}
        label={t.exam.nextLabel}
      />
      <Reading value={active === null ? '—' : String(Math.max(active, 0))} label={t.exam.activeLabel} />
      <Reading value={tally === null ? '—' : String(tally.finished)} label={t.exam.finishedLabel} />
      <Reading value={percent === null ? '—' : `${percent}%`} label={t.exam.progressLabel} />
    </div>
  )
}

function Reading({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="text-figure font-bold tabular-nums">{value}</div>
      <div className="text-micro uppercase tracking-[0.09em] text-muted-foreground">{label}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
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
 * The exam as a whole, student by student. It is read once, by the view, and
 * shown in two places: the strip up top and this panel.
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

          <div className="flex flex-wrap gap-2">
            <SessionExportButton session={session} />
            <SessionMoodleButton session={session} />
          </div>

          <div className="space-y-2">
            {session.students.map((student) => {
              const score = scoreView(student.score, scale)
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

