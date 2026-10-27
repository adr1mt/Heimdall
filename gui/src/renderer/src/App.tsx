import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FolderOpen,
  HelpCircle,
  History as HistoryIcon,
  Home,
  Info,
  ListChecks,
  Loader2,
  Monitor,
  Moon,
  Play,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  Settings as SettingsIcon,
  Sun,
  Users,
  X
} from 'lucide-react'
import { NAV_FOOTER, NAV_MAIN, comingSoon, type NavEntry } from './lib/nav'
import { useApp, noticeFrom, type View } from './stores/app'
import { useRun } from './stores/run'
import { cn } from './lib/utils'
import { shouldStartPass } from './lib/exam'
import { startCorrection } from './lib/start-run'
import { t } from './i18n/es'
import logo from './assets/logo.png'
import { ConfirmDialog } from '@/components/ui'

const HomeView = lazy(() => import('./routes/Home'))
const SettingsView = lazy(() => import('./routes/Settings'))
const HelpView = lazy(() => import('./routes/Help'))
const ResultsView = lazy(() => import('./routes/Results'))
const HistoryView = lazy(() => import('./routes/History'))
const ClassesView = lazy(() => import('./routes/Classes'))
const CorrectView = lazy(() => import('./routes/Correct'))
const EditorView = lazy(() => import('./routes/Editor'))
const AnalyticsView = lazy(() => import('./routes/Analytics'))

const ICONS: Record<View, typeof Home> = {
  home: Home,
  classes: Users,
  exams: FolderOpen,
  correct: Play,
  results: ListChecks,
  analytics: BarChart3,
  history: HistoryIcon,
  settings: SettingsIcon,
  help: HelpCircle
}

/**
 * The error boundary wraps the WHOLE application, not just the view: a failure
 * in the sidebar would otherwise leave the screen blank with no way out but
 * restarting the app.
 */
export default function App() {
  return (
    <AppErrorBoundary>
      <AppBody />
    </AppErrorBoundary>
  )
}

function AppBody() {
  const { theme, view, setView, toggleTheme } = useApp()
  const sidebar = useApp((s) => s.sidebar)
  const setSidebar = useApp((s) => s.setSidebar)
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1180px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1180px)')
    const update = () => setNarrow(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const collapsed = sidebar === 'collapsed' || (sidebar === 'auto' && narrow)
  const notice = useApp((s) => s.notice)
  const noticeKind = useApp((s) => s.noticeKind)
  const setNotice = useApp((s) => s.setNotice)
  const setEngine = useApp((s) => s.setEngine)
  // Without an exam open there is nothing to correct, no results and no
  // history: those sections are disabled, not hidden (lib/nav).
  const hasProject = useApp((s) => s.project !== null)
  const projector = useApp((s) => s.projector)
  const update = useApp((s) => s.update)
 const draft=useApp((s)=>s.editorDraft)
 const pendingNavigation=useApp((s)=>s.pendingNavigation)
 useEffect(()=> {
  if (!draft || draft.text===draft.savedText) return
  const prevent=(event:BeforeUnloadEvent):void=> {event.preventDefault(); event.returnValue=""}
  window.addEventListener("beforeunload",prevent)
  return ()=>window.removeEventListener("beforeunload",prevent)
 },[draft])
  const setUpdate = useApp((s) => s.setUpdate)

  // A version waiting to be installed is news, not an interruption: it lands
  // on a line that can be dismissed and nothing else happens until the
  // teacher closes the application.
  useEffect(() => window.heimdall.onUpdateReady(setUpdate), [setUpdate])
  useEffect(() => window.heimdall.onBackupWarning(setNotice), [setNotice])

  useEffect(() => {
    window.heimdall
      .detectEngine()
      .then(setEngine)
      .catch((error) => setNotice(noticeFrom('No se pudo comprobar el motor', error)))
  }, [setEngine, setNotice])

  // The stream is followed from here and not from the view: changing views
  // mid-correction would otherwise drop events, and a lost event is progress
  // the teacher never sees again.
  //
  // `run.end` also points at the artifact, which is where the result really
  // lives: it is opened right away and the teacher lands on Resultados.
  useEffect(() => {
    const offEvent = window.heimdall.onRunEvent((event) => {
      useRun.getState().event(event)
      if (event.event !== 'run.end' || !event.artifact) return
      // The round joins the session before anything else: what it is worth is
      // asked of the engine with the whole list (ADR-0020).
      if (useApp.getState().exam.active) useApp.getState().examRoundFinished(event.artifact)
      const revision = useRun.getState().revision
      window.heimdall
        .readArtifact(event.artifact)
        .then((artifact) => {
          if (revision !== useRun.getState().revision) return
          if (artifact.status === 'CANCELLED' && useRun.getState().artifact) {
            useRun.getState().artifactFailed('Corrección cancelada. Se conservan los resultados anteriores.')
            return
          }
          useRun.getState().setArtifact(artifact, event.artifact)
          useApp.getState().setView('results')
        })
        .catch((error) => {
          if (revision !== useRun.getState().revision) return
          const problem = noticeFrom('No se pudo abrir el resultado', error)
          useRun.getState().artifactFailed(problem)
          // Results has a quiet warning beside the clock. Other views still
          // need a visible explanation when no previous result can be shown.
          const app = useApp.getState()
          if (!useRun.getState().artifact || (app.view !== 'results' && !app.projector)) {
            app.setNotice(problem)
          }
        })
    })
    const offClosed = window.heimdall.onRunClosed((closed) => {
      useRun.getState().closed(closed)
      // The engine is gone: exam mode, if it is on, counts the interval from
      // here and never from the start of the pass.
      useApp.getState().examPassFinished()
    })
    return () => {
      offEvent()
      offClosed()
    }
  }, [])

  // The exam-mode timer lives here, next to the event stream and for the same
  // reason: changing views must not break the chain. It is the only place
  // that launches a pass on its own.
  useEffect(() => {
    const timer = setInterval(() => {
      const app = useApp.getState()
      if (!shouldStartPass(app.exam, useRun.getState().phase, Date.now())) return
      // Marked as started BEFORE the launch: nothing is due again until this
      // pass ends, so a slow start cannot let a second tick through.
      app.examPassStarted()
      void startCorrection({}).then((started) => {
        // It could not even be launched. The chain is not left hanging: the
        // next pass is due an interval from now, like any other.
        if (!started) useApp.getState().examPassFinished()
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // One action out of the projector, and the one a hand reaches for with the
  // class already looking at the screen. It is the same action as the button.
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape' && useApp.getState().projector) {
        useApp.getState().toggleProjector()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const views: Record<View, JSX.Element> = {
    home: <HomeView />,
    classes: <ClassesView />,
    exams: <EditorView />,
    correct: <CorrectView />,
    results: <ResultsView />,
    analytics: <AnalyticsView />,
    history: <HistoryView />,
    settings: <SettingsView />,
    help: <HelpView />
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <ConfirmDialog open={pendingNavigation!==null} title="Hay cambios sin guardar" confirmLabel="Descartar y salir" onCancel={()=>useApp.getState().resolveNavigation(false)} onConfirm={()=>useApp.getState().resolveNavigation(true)}>
        El borrador del examen no se ha guardado. Puedes volver al editor o descartarlo para salir.
      </ConfirmDialog>
      {/* Al proyectar desaparece entera: la barra es del profesor, no de la
          clase, y en la pared solo roba sitio a lo que se está mirando. */}
      {!projector && (
      <aside className="app-sidebar flex shrink-0 flex-col bg-sidebar text-sidebar-foreground" data-collapsed={collapsed}>
        <div className="sidebar-brand flex items-center gap-2 px-3 py-3">
          <img src={logo} alt="" className="h-8 w-8 object-contain" />
          <div className="sidebar-label flex-1 text-sm font-semibold tracking-tight">{t.app.name}</div>
          <button className="sidebar-toggle rounded p-2 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'} aria-expanded={!collapsed}
            title={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            onClick={() => setSidebar(collapsed ? 'expanded' : 'collapsed')}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav aria-label="Secciones principales" className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV_MAIN.map((entry) => (
            <NavButton
              key={entry.id}
              entry={entry}
              active={view === entry.id}
              hasProject={hasProject}
              onPick={setView}
            />
          ))}
        </nav>

        <div className="sidebar-footer space-y-2 px-3 pb-3">
          {/* Ajustes y Ayuda al pie: no son parte de corregir nada. */}
          <div className="flex flex-col gap-0.5 border-t border-white/10 pt-3">
            {NAV_FOOTER.map((entry) => (
              <NavButton
                key={entry.id}
                entry={entry}
                active={view === entry.id}
                hasProject={hasProject}
                onPick={setView}
              />
            ))}
          </div>
          <EngineBadge />
          <TeacherDisplay />
          <ProjectorToggle />
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t.theme.toLight : t.theme.toDark}
            title={theme === 'dark' ? t.theme.toLight : t.theme.toDark}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/70 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="sidebar-label">{theme === 'dark' ? t.theme.toLight : t.theme.toDark}</span>
          </button>
        </div>
      </aside>
      )}

      <main className="min-w-0 flex flex-1 flex-col overflow-hidden bg-background">
        {/* Sin barra lateral hay que poder salir igual, y con una sola acción. */}
        {projector && <ProjectorExit />}
        {update && !projector && (
          <div
            role="status"
            className="flex shrink-0 items-start gap-2 border-b border-border bg-muted px-4 py-2 text-sm text-muted-foreground"
          >
            <Download className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{t.update.ready(update)}</span>
            <button
              type="button"
              onClick={() => setUpdate(null)}
              className="rounded p-0.5 hover:bg-foreground/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t.update.dismiss}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {notice && (
          <div
            role={noticeKind === 'error' ? 'alert' : 'status'}
            className={cn(
              'flex shrink-0 items-start gap-2 border-b px-4 py-2 text-sm',
              noticeKind === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive-strong',
              noticeKind === 'success' && 'border-success/30 bg-success/10 text-success-strong',
              noticeKind === 'info' && 'border-border bg-muted text-muted-foreground'
            )}
          >
            {noticeKind === 'error'
              ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              : noticeKind === 'success'
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            <span className="min-w-0 flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded p-0.5 hover:bg-foreground/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t.errors.dismiss}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div key={view} className="min-h-0 flex-1 animate-fade-in">
          <ViewErrorBoundary key={view}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" aria-label="Cargando vista" />
                </div>
              }
            >
              {views[view]}
            </Suspense>
          </ViewErrorBoundary>
        </div>
      </main>
    </div>
  )
}

function NavButton({
  entry,
  active,
  hasProject,
  onPick
}: {
  entry: NavEntry
  active: boolean
  hasProject: boolean
  onPick: (view: View) => void
}) {
  const Icon = ICONS[entry.id]
  const waiting = entry.ready && entry.needsProject === true && !hasProject
  const open = entry.ready && !waiting
  return (
    <button
      disabled={!open}
      aria-disabled={!open}
      aria-current={active ? 'page' : undefined}
      aria-label={entry.label}
      title={
        entry.ready ? (waiting ? t.nav.needProject(entry.label) : entry.label) : comingSoon(entry.id)
      }
      onClick={() => onPick(entry.id)}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        active
          ? 'bg-primary/20 text-white'
          : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white',
        !open && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-sidebar-foreground/70'
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="sidebar-label">{entry.label}</span>
      {!entry.ready && (
        <span className="sidebar-label ml-auto text-glyph uppercase tracking-[0.09em] text-sidebar-foreground/40">
          {t.nav.soonBadge}
        </span>
      )}
    </button>
  )
}

/**
 * Projector mode. It is a switch and not a setting buried in Ajustes because
 * it gets pressed with the class already looking at the screen.
 */
function ProjectorToggle() {
  const projector = useApp((s) => s.projector)
  const toggleProjector = useApp((s) => s.toggleProjector)

  return (
    <button
      onClick={toggleProjector}
      aria-pressed={projector}
      aria-label={projector ? t.projector.off : t.projector.on}
      title={projector ? t.projector.hintOn : t.projector.hintOff}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        projector
          ? 'bg-primary/20 text-white'
          : 'text-sidebar-foreground/60 hover:bg-white/5 hover:text-white'
      )}
    >
      <Monitor className="h-4 w-4 shrink-0" />
      <span className="sidebar-label">{projector ? t.projector.off : t.projector.on}</span>
    </button>
  )
}

function TeacherDisplay() {
  const { uiZoom, setUiZoom, sidebar, setSidebar } = useApp()
  return (
    <details className="teacher-display relative">
      <summary aria-label="Vista del profesor" title="Vista del profesor"
        className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary">
        <SlidersHorizontal className="h-4 w-4 shrink-0" />
        <span className="sidebar-label">Vista profesor · {uiZoom} %</span>
      </summary>
      <div className="absolute bottom-full left-0 z-50 mb-2 w-60 space-y-3 rounded-md border border-border bg-popover p-3 text-sm text-popover-foreground">
        <label className="flex items-center justify-between gap-2">Escala de interfaz
          <select aria-label="Escala de interfaz" value={uiZoom} onChange={(e) => setUiZoom(Number(e.target.value))}
            className="h-8 rounded border border-input bg-background px-2 focus-visible:ring-2 focus-visible:ring-ring">
            {[80, 90, 100, 110, 120].map((value) => <option key={value} value={value}>{value} %</option>)}
          </select>
        </label>
        <button className="rounded px-2 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setUiZoom(100)}>Restablecer al 100 %</button>
        <label className="flex items-center justify-between gap-2">Menú lateral
          <select aria-label="Menú lateral" value={sidebar} onChange={(e) => setSidebar(e.target.value as typeof sidebar)}
            className="h-8 rounded border border-input bg-background px-2 focus-visible:ring-2 focus-visible:ring-ring">
            <option value="auto">Automático</option><option value="expanded">Expandido</option><option value="collapsed">Iconos</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground">El proyector tiene sus propios controles de zoom.</p>
      </div>
    </details>
  )
}

/**
 * The way out of the projector when the sidebar is gone. Small and in the
 * corner: it is for the teacher, and the wall is for the class.
 */
function ProjectorExit() {
  const toggleProjector = useApp((s) => s.toggleProjector)
  return (
    <div className="flex shrink-0 justify-end px-4 pt-3">
      <button
        onClick={toggleProjector}
        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Monitor className="h-4 w-4" />
        {t.projector.off}
      </button>
    </div>
  )
}

/** The engine's state, always in sight: without it nothing can be corrected. */
function EngineBadge() {
  const engine = useApp((s) => s.engine)
  const setView = useApp((s) => s.setView)

  if (!engine) {
    return (
      <div role="status" title={t.engine.checking} aria-label={t.engine.checking} className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-xs text-sidebar-foreground/60">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span className="sidebar-label truncate">{t.engine.checking}</span>
      </div>
    )
  }

  return engine.found ? (
    <div role="status" title={`${t.engine.ready} · ${engine.version}`} aria-label={`${t.engine.ready} · ${engine.version}`} className="flex items-center gap-2 rounded-md bg-sidebar-success/10 px-3 py-2 text-xs text-sidebar-success">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span className="sidebar-label truncate">
        {t.engine.ready} · {engine.version}
      </span>
    </div>
  ) : (
    <button
      onClick={() => setView('settings')}
      aria-label={t.engine.missing}
      title={t.engine.missing}
      className="flex w-full items-center gap-2 rounded-md bg-sidebar-destructive/10 px-3 py-2 text-left text-xs text-sidebar-destructive transition-colors hover:bg-sidebar-destructive/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-foreground"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="sidebar-label truncate">{t.engine.missing}</span>
    </button>
  )
}

interface BoundaryProps {
  children: ReactNode
  title: string
  /** What to undo before painting again; without it a deterministic failure
   *  throws right back as soon as it is retried. */
  onRetry?: () => void
  retryLabel: string
}

class ErrorCard extends Component<BoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error al renderizar', error, info)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-3 bg-background px-8 text-center"
      >
        <AlertTriangle className="h-8 w-8 text-destructive-strong" />
        <h1 className="font-semibold">{this.props.title}</h1>
        <p className="max-w-xl text-sm text-muted-foreground">{this.state.error.message}</p>
        <button
          type="button"
          onClick={() => {
            this.props.onRetry?.()
            this.setState({ error: null })
          }}
          className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          {this.props.retryLabel}
        </button>
      </div>
    )
  }
}

function ViewErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorCard
      title={t.errors.viewTitle}
      retryLabel={t.errors.backHome}
      onRetry={() => useApp.getState().setView('home')}
    >
      {children}
    </ErrorCard>
  )
}

function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorCard title={t.errors.appTitle} retryLabel={t.errors.retry}>
      {children}
    </ErrorCard>
  )
}
