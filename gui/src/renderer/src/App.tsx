import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  History as HistoryIcon,
  Home,
  ListChecks,
  Loader2,
  Moon,
  Settings as SettingsIcon,
  Sun,
  X
} from 'lucide-react'
import { useApp, noticeFrom, type View } from './stores/app'
import { useRun } from './stores/run'
import { cn } from './lib/utils'
import { t } from './i18n/es'

const HomeView = lazy(() => import('./routes/Home'))
const SettingsView = lazy(() => import('./routes/Settings'))
const HelpView = lazy(() => import('./routes/Help'))
const ResultsView = lazy(() => import('./routes/Results'))
const HistoryView = lazy(() => import('./routes/History'))

const NAV: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'home', label: t.nav.home, icon: Home },
  { id: 'results', label: t.nav.results, icon: ListChecks },
  { id: 'history', label: t.nav.history, icon: HistoryIcon },
  { id: 'settings', label: t.nav.settings, icon: SettingsIcon },
  { id: 'help', label: t.nav.help, icon: HelpCircle }
]

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
  const notice = useApp((s) => s.notice)
  const setNotice = useApp((s) => s.setNotice)
  const setEngine = useApp((s) => s.setEngine)

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
      window.heimdall
        .readArtifact(event.artifact)
        .then((artifact) => {
          useRun.getState().setArtifact(artifact, event.artifact)
          useApp.getState().setView('results')
        })
        .catch((error) =>
          useRun.getState().artifactFailed(noticeFrom('No se pudo abrir el resultado', error))
        )
    })
    const offClosed = window.heimdall.onRunClosed((closed) => useRun.getState().closed(closed))
    return () => {
      offEvent()
      offClosed()
    }
  }, [])

  const views: Record<View, JSX.Element> = {
    home: <HomeView />,
    results: <ResultsView />,
    history: <HistoryView />,
    settings: <SettingsView />,
    help: <HelpView />
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-base font-bold">H</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">{t.app.name}</div>
            <div className="text-micro text-sidebar-foreground/50">{t.app.tagline}</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const active = view === item.id
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/20 text-white'
                    : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white'
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="space-y-3 px-4 pb-4">
          <EngineBadge />
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? t.theme.toLight : t.theme.toDark}
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        {notice && (
          <div
            role="alert"
            className="flex shrink-0 items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive-strong"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded p-0.5 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

/** The engine's state, always in sight: without it nothing can be corrected. */
function EngineBadge() {
  const engine = useApp((s) => s.engine)
  const setView = useApp((s) => s.setView)

  if (!engine) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-xs text-sidebar-foreground/60">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span className="truncate">{t.engine.checking}</span>
      </div>
    )
  }

  return engine.found ? (
    <div className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-xs text-success-strong">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span className="truncate">
        {t.engine.ready} · {engine.version}
      </span>
    </div>
  ) : (
    <button
      onClick={() => setView('settings')}
      className="flex w-full items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-left text-xs text-destructive-strong transition-colors hover:bg-destructive/20"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="truncate">{t.engine.missing}</span>
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
          className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
