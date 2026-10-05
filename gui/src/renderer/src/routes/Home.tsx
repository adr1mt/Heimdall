import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, FolderSymlink, Plus, X } from 'lucide-react'
import { Button, ConfirmDialog, SectionTitle, Spinner, ViewHeader } from '@/components/ui'
import { useApp, noticeFrom } from '@/stores/app'
import { useRun } from '@/stores/run'
import { t } from '@/i18n/es'
import type { RecentProject } from '../../../shared/types'

/**
 * Inicio: the list of exams the teacher works with.
 *
 * A project is a folder with its exam inside, so opening one is choosing a
 * folder and nothing else: the exam has a fixed name and the application
 * finds it. No file is picked by hand and no path is on screen — what the
 * teacher recognises is the name they gave the exam.
 *
 * Correcting is the next step and lives in «Corregir», with the class: the
 * same exam is corrected with 2SMX C and with 2SMX D and belongs to neither.
 */
export default function HomeView() {
  const setProject = useApp((s) => s.setProject)
  const setNotice = useApp((s) => s.setNotice)
  const exam = useApp((s) => s.exam)
  const phase = useRun((s) => s.phase)

  const [recents, setRecents] = useState<RecentProject[] | null>(null)
  /** The folder being opened right now, so the row says so and nothing else moves. */
  const [busy, setBusy] = useState<string | null>(null)
  /**
   * What was going to be opened while a correction is running. Opening another
   * exam stops it, so it is asked first (principio 4: nothing is lost quietly).
   */
  const [pending, setPending] = useState<{ dir: string; create: boolean } | null>(null)

  const correcting = phase === 'starting' || phase === 'running' || exam.active

  const refresh = useCallback(() => {
    window.heimdall
      .recentProjects()
      .then(setRecents)
      .catch((error) => {
        setRecents([])
        setNotice(noticeFrom('No se pudo leer la lista de exámenes', error))
      })
  }, [setNotice])

  useEffect(refresh, [refresh])

  /** Opens or creates, once nothing is in the way. */
  async function go(dir: string, create: boolean): Promise<void> {
    setBusy(dir)
    try {
      if (correcting) await stopCorrection()
      const project = create
        ? await window.heimdall.createProject(dir)
        : await window.heimdall.openProject(dir)
      // Nothing of the previous exam survives the change: its result is not
      // this exam's, and the store drops its session and its pending retry.
      useRun.getState().reset()
      setNotice(null)
      setProject(project)
    } catch (error) {
      setNotice(noticeFrom(t.home.missing, error))
    } finally {
      setBusy(null)
      refresh()
    }
  }

  /** Asks first when a correction is in flight; goes straight through if not. */
  function guard(dir: string, create: boolean): void {
    if (correcting) {
      setPending({ dir, create })
      return
    }
    void go(dir, create)
  }

  async function pick(create: boolean): Promise<void> {
    try {
      const dir = await window.heimdall.pickDirectory()
      if (dir) guard(dir, create)
    } catch (error) {
      setNotice(noticeFrom('No se pudo elegir la carpeta', error))
    }
  }

  /**
   * Opens the project's folder in the system's file manager. The folder is
   * where the exam and its corrections live, and looking for it by hand from
   * the name written inside the exam is not looking for anything (T120).
   */
  async function reveal(dir: string): Promise<void> {
    try {
      await window.heimdall.openFolder(dir)
    } catch (error) {
      setNotice(noticeFrom(t.home.folderFailed, error))
    }
  }

  async function forget(dir: string): Promise<void> {
    try {
      setRecents(await window.heimdall.removeRecent(dir))
    } catch (error) {
      setNotice(noticeFrom('No se pudo quitar el examen de la lista', error))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={t.home.title}
        actions={
          <>
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void pick(false)}>
              <FolderOpen className="h-4 w-4" />
              {t.home.open}
            </Button>
            <Button size="sm" disabled={busy !== null} onClick={() => void pick(true)}>
              <Plus className="h-4 w-4" />
              {t.home.create}
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="max-w-3xl space-y-3">
          <SectionTitle hint={t.home.subtitle}>{t.home.recent}</SectionTitle>

          {recents === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> {t.home.opening}
            </p>
          ) : recents.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t.home.noRecent}</p>
          ) : (
            <ul>
              {recents.map((recent) => (
                <RecentRow
                  key={recent.dir}
                  recent={recent}
                  busy={busy === recent.dir}
                  disabled={busy !== null}
                  onOpen={() => guard(recent.dir, false)}
                  onReveal={() => void reveal(recent.dir)}
                  onForget={() => void forget(recent.dir)}
                />
              ))}
            </ul>
          )}
          {recents !== null && recents.length > 0 && (
            <p className="text-micro text-muted-foreground">{t.home.removeHint}</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={t.home.inProgress}
        confirmLabel={t.home.inProgressConfirm}
        destructive
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const target = pending
          setPending(null)
          if (target) void go(target.dir, target.create)
        }}
      >
        {t.home.inProgressBody}
      </ConfirmDialog>
    </div>
  )
}

/**
 * Stops whatever is correcting before another exam is opened. What has been
 * corrected is kept, because the engine is cancelled and not killed, and exam
 * mode is turned off in the main process so its credentials are wiped.
 */
async function stopCorrection(): Promise<void> {
  const app = useApp.getState()
  if (app.exam.active) {
    app.stopExam()
    await window.heimdall.setExamMode({ active: false })
  }
  await window.heimdall.cancelRun()
}

/**
 * One exam in the list, by the name the teacher gave it. The folder it lives
 * in is not on screen: a path is what the computer needs, and «/home/…/2smx/
 * examen.yaml» in front of a class says nothing about which exam it is.
 */
function RecentRow({
  recent,
  busy,
  disabled,
  onOpen,
  onReveal,
  onForget
}: {
  recent: RecentProject
  busy: boolean
  disabled: boolean
  onOpen: () => void
  onReveal: () => void
  onForget: () => void
}) {
  return (
    <li className="flex items-center border-b border-border/70">
      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-3 pl-2 pr-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{recent.name}</div>
          {busy && <div className="text-xs text-muted-foreground">{t.home.opening}</div>}
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1 pr-1">
        {busy ? (
          <Spinner className="h-4 w-4" />
        ) : (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={onReveal}
              className={ROW_ACTION}
              title={t.home.openFolder}
              aria-label={`${t.home.openFolder}: ${recent.name}`}
            >
              <FolderSymlink className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onForget}
              className={ROW_ACTION}
              title={t.home.removeRecent}
              aria-label={`${t.home.removeRecent}: ${recent.name}`}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </li>
  )
}

/** Las acciones de cada examen siempre se ven y siguen el orden de teclado de la fila. */
const ROW_ACTION =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'
