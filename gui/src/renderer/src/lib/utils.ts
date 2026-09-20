import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatDuration(value: string | number | undefined): string {
  if (value === undefined) return '—'
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (!Number.isFinite(n)) return String(value)
  return `${n.toFixed(3)}s`
}

export function basename(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() || p
}
