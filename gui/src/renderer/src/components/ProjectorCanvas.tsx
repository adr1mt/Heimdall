import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Minus, Plus, Maximize } from 'lucide-react'
import { Button } from '@/components/ui'
import { useResultsView } from '@/stores/results-view'

/** Scale the rendered content, retaining all the canonical data and controls. */
export function ProjectorCanvas({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const { projectorZoom: zoom, projectorFit: fit, setProjectorScale } = useResultsView()
  const [layout, setLayout] = useState({ width: 0, scale: 1 })
  useLayoutEffect(() => {
    const outer = viewport.current!, inner = content.current!
    const measure = () => {
      const width = outer.clientWidth
      const horizontal = inner.scrollWidth > inner.clientWidth + 1 ? (width - 4) / inner.scrollWidth : 1.5
      const scale = Math.max(0.01, Math.min(1.5, horizontal, (outer.clientHeight - 6) / Math.max(1, inner.scrollHeight)))
      setLayout((previous) => previous.width === width && Math.abs(previous.scale - scale) < 0.001 ? previous : { width, scale })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [fit])
  const effective = fit ? layout.scale : zoom
  // Measure an unscaled, stable width. Dividing it by the fitted zoom feeds
  // each measurement back into the next and can oscillate with many columns.
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-6 py-2" aria-label="Tamaño del proyector">
        <Button size="sm" variant="outline" aria-label="Reducir zoom" disabled={effective <= 0.01 && !fit}
          onClick={() => setProjectorScale(Math.max(0.01, Math.round((effective - 0.1) * 100) / 100), false)}><Minus className="h-4 w-4" /></Button>
        <output className="w-14 text-center text-xs tnum" aria-label="Zoom actual">{Math.round(effective * 100)} %</output>
        <Button size="sm" variant="outline" aria-label="Aumentar zoom" disabled={effective >= 2 && !fit}
          onClick={() => setProjectorScale(Math.min(2, Math.round((effective + 0.1) * 100) / 100), false)}><Plus className="h-4 w-4" /></Button>
        <Button size="sm" variant={fit ? 'secondary' : 'outline'} aria-pressed={fit}
          onClick={() => setProjectorScale(zoom, !fit)}><Maximize className="h-4 w-4" />Ajustar a pantalla</Button>
        {fit && <span className="text-xs text-muted-foreground">Todos los alumnos y casos visibles · usa + para ampliar</span>}
      </div>
      <div ref={viewport} className="min-h-0 flex-1 overflow-auto">
        <div ref={content} className={fit ? 'projector-content projector-fit' : 'projector-content'}
          style={{ zoom: effective, width: fit && layout.width ? layout.width : undefined }}>{children}</div>
      </div>
    </>
  )
}
