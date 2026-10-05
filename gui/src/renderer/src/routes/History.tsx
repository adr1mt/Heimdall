import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, FolderOpen, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
import { Badge, Button, Spinner, ViewHeader } from '@/components/ui'
import { useApp, noticeFrom } from '@/stores/app'
import { useRun } from '@/stores/run'
import { dateText } from '@/lib/results'
import { t } from '@/i18n/es'
import type { RunSummary } from '../../../shared/history'
import type { BackupEntry } from '../../../shared/backup'

/** As many rows as the main process is willing to summarise (history.ts). */
const MAX_RUNS = 50

/** As many copies as the main process keeps of one exam (backup.ts). */
const MAX_BACKUPS = 50

/**
 * The corrections already on disk. Nothing here evaluates anything: it lists
 * artifacts and hands the one the teacher picks to Resultados, which is the
 * same screen and the same artifact as the day it was corrected.
 */
export default function HistoryView() {
  const examPath = useApp((s) => s.project?.examPath ?? null)
  const setView = useApp((s) => s.setView)
  const setNotice = useApp((s) => s.setNotice)
  const phase = useRun((s) => s.phase)
  const busy = phase === 'starting' || phase === 'running'

  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [backups, setBackups] = useState<BackupEntry[] | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  const load = useCallback(() => {
    if (!examPath) {
      setRuns([])
      setBackups([])
      setRunError(null)
      setBackupError(null)
      return
    }
    setRuns(null)
    setRunError(null)
    window.heimdall
      .listRuns(examPath)
      .then(setRuns)
      .catch((error) => {
        setRunError(noticeFrom('No se pudo leer el histórico', error))
      })
    setBackups(null)
    setBackupError(null)
    window.heimdall
      .listBackups(examPath)
      .then(setBackups)
      .catch((error) => {
        setBackupError(noticeFrom('No se pudieron leer las copias de seguridad', error))
      })
  }, [examPath])

  useEffect(load, [load])

  async function open(path: string): Promise<void> {
    setOpening(path)
    try {
      const artifact = await window.heimdall.readArtifact(path)
      useRun.getState().setArtifact(artifact, path)
      setView('results')
    } catch (error) {
      setNotice(noticeFrom('No se pudo abrir el resultado', error))
    } finally {
      setOpening(null)
    }
  }

  /**
   * Puts the copies back. It never overwrites a correction already in the
   * folder, so pressing it twice —or pressing it by mistake— cannot lower a
   * grade that is already saved.
   */
  async function restore(): Promise<void> {
    if (!examPath) return
    setRestoring(true)
    try {
      const report = await window.heimdall.restoreBackups(examPath)
      const done = t.backups.done(report.restored, report.kept)
      setNotice(report.problems?.length
        ? `${done} Se omitieron ${report.problems.length} copias con problemas. ${report.problems[0]}`
        : done)
      load()
    } catch (error) {
      setNotice(noticeFrom('No se pudieron restaurar las notas', error))
    } finally {
      setRestoring(false)
    }
  }

  async function openOther(): Promise<void> {
    try {
      const picked = await window.heimdall.pickFile('result')
      if (picked) await open(picked)
    } catch (error) {
      setNotice(noticeFrom('No se pudo abrir el fichero', error))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t.history.title} />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <p className="max-w-3xl text-xs text-muted-foreground">{t.history.hint}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={!examPath} onClick={load}>
            <RefreshCw className="h-4 w-4" />
            {t.history.refresh}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void openOther()}>
            <FolderOpen className="h-4 w-4" />
            {t.history.openOther}
          </Button>
        </div>

        {/* Opening a past run replaces what Resultados is showing, and mid-run
            that would be the correction in flight. It waits. */}
        {busy && <p className="text-xs text-warning-strong">{t.history.busy}</p>}

        {!examPath ? (
          <p className="text-sm text-muted-foreground">{t.history.needExam}</p>
        ) : runError ? (
          <p className="flex items-start gap-1.5 break-all text-sm text-destructive-strong">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {runError}
          </p>
        ) : runs === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> {t.history.loading}
          </p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.history.empty}</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <RunRow
                key={run.path}
                run={run}
                disabled={busy || opening !== null}
                opening={opening === run.path}
                onOpen={() => void open(run.path)}
              />
            ))}
            {runs.length >= MAX_RUNS && (
              <p className="text-micro text-muted-foreground">{t.history.capped(MAX_RUNS)}</p>
            )}
          </div>
        )}

        {examPath && (
          <Backups
            backups={backups}
            error={backupError}
            restoring={restoring}
            disabled={busy}
            onRestore={() => void restore()}
          />
        )}
      </div>
    </div>
  )
}

/**
 * The safety copies of this exam. They live in the application's own folder,
 * so deleting the exam's folder does not take the grades with it. What a copy
 * holds is the grade of every student, never the output of their machines.
 */
function Backups({
  backups,
  error,
  restoring,
  disabled,
  onRestore
}: {
  backups: BackupEntry[] | null
  error: string | null
  restoring: boolean
  disabled: boolean
  onRestore: () => void
}) {
  const recoverable = backups?.filter((backup) => !backup.problem && !backup.onDisk).length ?? 0
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">{t.backups.title}</h2>
      </div>
      <p className="max-w-3xl text-xs text-muted-foreground">{t.backups.hint}</p>

      {error ? (
        <p className="flex items-start gap-1.5 break-all text-sm text-destructive-strong">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      ) : backups === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> {t.backups.loading}
        </p>
      ) : backups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.backups.empty}</p>
      ) : (
        <>
          <div className="space-y-1">
            {backups.map((backup) => (
              <div
                key={backup.path}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                {backup.problem ? (
                  <span className="flex items-start gap-1.5 break-all text-destructive-strong">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {backup.problem}
                  </span>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      {dateText(backup.at ?? '')} · {t.backups.counts(backup.students ?? 0)}
                    </span>
                    <Badge variant={backup.onDisk ? 'success' : 'warning'}>
                      {backup.onDisk ? t.backups.onDisk : t.backups.missing}
                    </Badge>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || restoring || recoverable === 0}
              onClick={onRestore}
            >
              {restoring ? <Spinner /> : null}
              {restoring ? t.backups.restoring : t.backups.restore}
            </Button>
            <span className="text-micro text-muted-foreground">
              {t.backups.capped(MAX_BACKUPS)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * One correction. A file that cannot be read keeps its row and says why: a
 * correction that happened must not disappear from the list because its
 * artifact is broken.
 */
function RunRow({
  run,
  disabled,
  opening,
  onOpen
}: {
  run: RunSummary
  disabled: boolean
  opening: boolean
  onOpen: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{dateText(run.at)}</span>
          {run.status && (
            <Badge variant={run.status === 'COMPLETE' ? 'success' : 'warning'}>
              {t.history.status[run.status]}
            </Badge>
          )}
          {run.retryOf && (
            <span className="flex items-center gap-1 text-micro text-muted-foreground">
              <RotateCcw className="h-3 w-3" />
              {t.history.retryOf(run.retryOf)}
            </span>
          )}
        </div>
        {run.problem ? (
          <p className="flex items-start gap-1.5 text-xs text-destructive-strong">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {run.problem}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {run.exam} · {run.classroom} ·{' '}
            {t.history.counts(run.students ?? 0, run.checks ?? 0)}
          </p>
        )}
        <p className="truncate font-mono text-micro text-muted-foreground" title={run.path}>
          {run.path}
        </p>
      </div>
      {run.problem ? (
        <span className="text-xs text-muted-foreground">{t.history.unreadable}</span>
      ) : (
        <Button variant="outline" size="sm" disabled={disabled} onClick={onOpen}>
          {opening ? <Spinner /> : null}
          {t.history.open}
        </Button>
      )}
    </div>
  )
}
