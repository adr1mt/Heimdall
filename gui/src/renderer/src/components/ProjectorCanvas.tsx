import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Minus, Plus, Maximize } from 'lucide-react'
import { Button } from '@/components/ui'
import { useResultsView } from '@/stores/results-view'

/** Scale the rendered content, retaining all the canonical data and controls. */
export function ProjectorCanvas({ children, toolbar }: { children: ReactNode; toolbar?: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const { projectorZoom: zoom, projectorFit: fit, setProjectorScale } = useResultsView()
  const [layout, setLayout] = useState({ width: 0, scale: 1, matrix: false })
  useLayoutEffect(() => {
    const outer = viewport.current!, inner = content.current!
    const measure = () => {
      const width = outer.clientWidth
      const matrix = inner.querySelector<HTMLTableElement>('.results-matrix')
      // Use the minimum column widths, never the expanded fitted table: using
      // its stretched width here would feed the previous zoom back into itself.
      const minimum = matrix ? parseFloat(getComputedStyle(matrix).minWidth) : NaN
      const requiredWidth = Number.isFinite(minimum) ? minimum + 32 : inner.scrollWidth
      const horizontal = matrix || inner.scrollWidth > inner.clientWidth + 1 ? (width - 4) / requiredWidth : 1.5
      const scale = Math.max(0.01, Math.min(1.5, horizontal, (outer.clientHeight - 6) / Math.max(1, inner.scrollHeight)))
      setLayout((previous) => previous.width === width && previous.matrix === !!matrix && Math.abs(previous.scale - scale) < 0.001 ? previous : { width, scale, matrix: !!matrix })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [fit])
  const effective = fit ? layout.scale : zoom
  // Matrix columns can fill the available width after scaling because their
  // minimum widths are measured independently. Lists keep a stable layout width.
  return (
    <>
      <div className="projector-toolbar flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1">
        <div className="min-w-0 flex-1">{toolbar}</div>
        <div className="flex items-center gap-1" aria-label="Tamaño del proyector">
          <Button size="sm" variant="ghost" className="h-8 w-8 px-0" aria-label="Reducir zoom" title="Reducir zoom"
            disabled={effective <= 0.01 && !fit}
            onClick={() => setProjectorScale(Math.max(0.01, Math.round((effective - 0.1) * 100) / 100), false)}><Minus className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 px-0" aria-label="Aumentar zoom" title="Aumentar zoom"
            disabled={effective >= 2 && !fit}
            onClick={() => setProjectorScale(Math.min(2, Math.round((effective + 0.1) * 100) / 100), false)}><Plus className="h-4 w-4" /></Button>
          <Button size="sm" variant={fit ? 'secondary' : 'ghost'} className="h-8" aria-pressed={fit}
            aria-label="Ajustar a pantalla" title="Ajustar todos los resultados a la pantalla"
            onClick={() => setProjectorScale(zoom, !fit)}><Maximize className="h-4 w-4" />Encajar</Button>
        </div>
      </div>
      <div ref={viewport} className="min-h-0 flex-1 overflow-auto">
        <div ref={content} className={fit ? 'projector-content projector-fit' : 'projector-content'}
          style={{ zoom: effective, width: fit && layout.width ? layout.width / (layout.matrix ? effective : 1) : undefined }}>{children}</div>
      </div>
    </>
  )
}
