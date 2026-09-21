import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ---- Button ----
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      // Planos: en un sistema de tono + filete de 1px, la sombra bajo un botón
      // asentado no aporta profundidad, solo suciedad al proyectar.
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        success: 'bg-success text-success-foreground hover:bg-success/90'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
)
Button.displayName = 'Button'

// ---- Card ----
export function Card({
  className,
  as: Tag = 'div',
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: 'div' | 'button' }) {
  return (
    <Tag
      className={cn('rounded-lg border border-border bg-card text-card-foreground', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-semibold leading-tight tracking-tight', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}

// ---- Badge ----
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        // Texto siempre en la variante «-strong»: color puro sobre su propio
        // tinte es el fallo de contraste que estos tokens vinieron a arreglar,
        // y estas insignias se proyectan en clase.
        default: 'bg-primary/15 text-primary',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-success/15 text-success-strong',
        warning: 'bg-warning/15 text-warning-strong',
        destructive: 'bg-destructive/15 text-destructive-strong',
        outline: 'border border-border text-muted-foreground'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

// ---- Input ----
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

// ---- Cabecera de vista ----
/**
 * Único spec de cabecera de la aplicación. Antes había dos —las vistas tranquilas
 * (Inicio, Ajustes, Ayuda) titulaban a 30px con margen de página, las de
 * operación a 18px dentro de una barra— y el escalón grande le tocaba justo a la
 * vista que menos lo necesita. Aquí la barra es siempre la misma altura, siempre
 * fija, y lo que crece es el contenido de debajo.
 */
export function ViewHeader({
  title,
  meta,
  actions,
  className
}: {
  title: React.ReactNode
  /** Contexto a la derecha del título: clase activa, recuento, fecha. */
  meta?: React.ReactNode
  /** Controles alineados al final de la barra. */
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-6 py-2',
        className
      )}
    >
      <h1 className="text-ui font-semibold tracking-tight">{title}</h1>
      {meta}
      {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </header>
  )
}

/** Rótulo de contexto: la clase activa, un recuento. Informativo, nunca pulsable. */
export function MetaChip({
  icon,
  children
}: {
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
      {icon}
      {children}
    </span>
  )
}

// ---- Control segmentado ----
/**
 * Un solo control segmentado para toda la app. Existían dos implementaciones
 * casi idénticas (Lista/Matriz en Resultados, las pestañas del Editor) y solo
 * una anunciaba su estado; esta lo hace siempre.
 */
export function Segmented({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      className={cn('flex items-center rounded-md border border-border p-0.5', className)}
      {...props}
    />
  )
}

export function SegmentedItem({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded-[0.25rem] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
        className
      )}
      {...props}
    />
  )
}

// ---- Bloque plegado ----
/**
 * Un bloque técnico que se anuncia en una línea y se abre cuando hace falta.
 *
 * Los avisos del motor —huella de la máquina, host, mensajes internos— son
 * información que no se puede perder y que tampoco puede mandar en la
 * pantalla: media pantalla de diagnóstico empuja a la clase fuera de la vista.
 * Aquí ocupan un renglón hasta que alguien pregunta, y abiertos siguen
 * diciéndolo todo.
 */
export function Foldaway({
  icon,
  summary,
  tone = 'neutral',
  defaultOpen = false,
  children
}: {
  icon?: React.ReactNode
  /** Lo que se lee sin abrir: qué hay y cuánto. */
  summary: React.ReactNode
  tone?: 'neutral' | 'warning'
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <div className={cn('rounded-md', tone === 'warning' ? 'bg-warning/10' : 'border border-border')}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          tone === 'warning' ? 'text-warning-strong' : 'text-foreground'
        )}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground">
          {open ? 'Ocultar' : 'Ver'}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-3 px-3 pb-3">{children}</div>}
    </div>
  )
}

// ---- Título de sección ----
/** Encabezado de bloque sin tarjeta: el filete hace de contenedor. */
export function SectionTitle({
  children,
  hint,
  actions
}: {
  children: React.ReactNode
  hint?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-border pb-2">
      <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {actions && <div className="ml-auto">{actions}</div>}
    </div>
  )
}

// ---- Medidor de avance (objetivos superados) ----
/**
 * Barra de un alumno: cuántos objetivos lleva superados. Se lee a distancia
 * antes que la cifra, y por eso acompaña siempre al número, nunca lo sustituye.
 */
export function Meter({
  value,
  total,
  tone = 'neutral',
  className
}: {
  value: number
  total: number
  tone?: 'pass' | 'fail' | 'neutral'
  className?: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      role="img"
      aria-label={`${value} de ${total} objetivos superados`}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300 ease-out',
          tone === 'pass' ? 'bg-success' : tone === 'fail' ? 'bg-destructive' : 'bg-muted-foreground/50'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ---- ConfirmDialog ----
/**
 * Diálogo de confirmación dentro de la app. Sustituye a `window.confirm`, que en
 * Electron sale sin estilos, en el idioma del sistema y se descarta por reflejo:
 * mala barrera para acciones que borran datos del alumnado.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive,
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  children?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()

  React.useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // El foco arranca en Cancelar: la tecla obvia nunca es la destructiva.
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Tab') {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) || []
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previousFocus?.focus()
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-6 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-fade-in rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {children && <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---- Entrada en línea para nombrar un campo ----
// ---- Menu (overflow) ----
/**
 * Menú de desbordamiento. Existe para sacar de la barra principal las acciones
 * poco frecuentes o destructivas, que no deben estar a un clic de distancia de
 * «Recargar» mientras se proyecta un examen.
 */
export function Menu({
  label,
  icon,
  title,
  children
}: {
  label: string
  icon: React.ReactNode
  /** Tooltip; por defecto, la etiqueta. Útil para reflejar el estado actual. */
  title?: string
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const close = React.useCallback(() => setOpen(false), [])

  React.useEffect(() => {
    if (!open) return
    const focusFrame = requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    })
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        triggerRef.current?.focus()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])
      if (items.length === 0) return
      e.preventDefault()
      const current = items.indexOf(document.activeElement as HTMLElement)
      const next = e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : e.key === 'ArrowDown'
            ? (current + 1 + items.length) % items.length
            : (current - 1 + items.length) % items.length
      items[next].focus()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(focusFrame)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <div ref={ref} className="relative">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        title={title ?? label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {icon}
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 min-w-[15rem] animate-fade-in rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  destructive
}: {
  icon?: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {icon}
      {children}
    </button>
  )
}

// ---- Spinner ----
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn(
        'h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className
      )}
    />
  )
}

// ---- ProgressBar ----
export function ProgressBar({
  percent,
  label,
  className
}: {
  /** 0-100, o null para una barra indeterminada (aún no se sabe el total). */
  percent: number | null
  label?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {percent != null && <span className="tabular-nums">{percent}%</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-label={typeof label === 'string' ? label : 'Progreso'}
      >
        <div
          className={cn(
            'h-full rounded-full bg-primary transition-[width] duration-500 ease-out',
            percent == null && 'w-1/3 animate-pulse'
          )}
          style={percent != null ? { width: `${percent}%` } : undefined}
        />
      </div>
    </div>
  )
}
