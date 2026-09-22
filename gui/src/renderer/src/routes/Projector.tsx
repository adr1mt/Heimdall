import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { board, type BoardRow, type BoardState } from '@/lib/board'
import { scaleOf } from '@/lib/export'
import { useApp } from '@/stores/app'
import { useRun } from '@/stores/run'
import { cn } from '@/lib/utils'
import { t } from '@/i18n/es'

/**
 * The projector: the class on the wall and nothing else.
 *
 * It replaces the whole application while it is on —no sidebar, no menus, no
 * other section reachable— because everything else on screen is either noise
 * from the back of the room or something the class has no business reading:
 * addresses, commands, the output of a classmate's machine.
 *
 * What is on the wall comes from `board`, which is built from four things per
 * student and a machine is not one of them. There is nothing to cover here.
 */
export default function Projector() {
  const toggleProjector = useApp((s) => s.toggleProjector)
  const scaleId = useApp((s) => s.scale)
  const state = useRun()
  const view = useMemo(() => board(state, scaleOf(scaleId)), [state, scaleId])

  // One action to get out, and the one a hand reaches for with the class
  // watching. The button is the visible one; this is the same action.
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') toggleProjector()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleProjector])

  return (
    <main className="flex h-full w-full flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-baseline gap-4 px-8 pb-4 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t.projector.title}</h1>
        <p className="text-lg text-muted-foreground">
          {view.students === 0
            ? t.projector.idle
            : t.projector.progress(view.finished, view.students)}
        </p>
        <button
          onClick={toggleProjector}
          className="ml-auto flex items-center gap-2 rounded-md px-3 py-2 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" />
          {t.projector.leave}
        </button>
      </header>

      {view.rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-8">
          <p className="text-xl text-muted-foreground">{t.projector.empty}</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
          <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(22rem,1fr))]">
            {view.rows.map((row) => (
              <StudentCard key={row.studentId} row={row} />
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}

/** The colours of the four states, the only thing readable from the last row. */
const TONE: Record<BoardState, string> = {
  waiting: 'border-border',
  running: 'border-primary',
  finished: 'border-success',
  excluded: 'border-border opacity-50'
}

function StudentCard({ row }: { row: BoardRow }) {
  return (
    <li className={cn('rounded-lg border-l-4 bg-card px-5 py-4', TONE[row.state])}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="truncate text-xl font-semibold">{row.name}</span>
        <span className="shrink-0 text-3xl font-bold tabular-nums">
          {row.grade || <span className="text-xl font-normal text-muted-foreground">—</span>}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            row.state === 'finished' ? 'bg-success' : 'bg-primary'
          )}
          style={{ width: `${row.percent}%` }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3 text-base">
        <span
          className={cn(
            'font-semibold uppercase tracking-wide',
            row.state === 'finished' ? 'text-success-strong' : 'text-muted-foreground'
          )}
        >
          {t.projector.state[row.state]}
        </span>
        {row.state !== 'excluded' && (
          <span className="tabular-nums text-muted-foreground">
            {t.projector.checks(row.done, row.total)}
          </span>
        )}
      </div>
    </li>
  )
}
