import { create } from 'zustand'
import type { EngineStatus } from '../../../shared/types'
import { DEFAULT_SCALE, type ScaleId } from '@/lib/export'

export type View = 'home' | 'results' | 'history' | 'settings' | 'help'
export type Theme = 'dark' | 'light'

interface AppState {
  theme: Theme
  view: View
  /** null while the engine has not been looked for yet. */
  engine: EngineStatus | null
  /** The exam file the teacher picked, if any. */
  examPath: string | null
  /** The classroom file the teacher picked, if any. */
  classPath: string | null
  /** One operational notice on screen, or null. */
  notice: string | null
  /**
   * The scale the teacher marks in. It only affects what is exported: the
   * artifact keeps the engine's 0-100 whatever this says.
   */
  scale: ScaleId
  /**
   * The correction the next run repeats, when the teacher asked for it. Null
   * is the ordinary case and also the default: leaving an incomplete pending
   * is the safe action and nothing here happens on its own (ADR-0018 §1).
   */
  retry: RetryRequest | null

  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setView: (view: View) => void
  setEngine: (engine: EngineStatus) => void
  setExamPath: (path: string | null) => void
  setClassPath: (path: string | null) => void
  setNotice: (message: string | null) => void
  setScale: (scale: ScaleId) => void
  setRetry: (retry: RetryRequest | null) => void
}

/** What the teacher asked to repeat, as the interface carries it around. */
export interface RetryRequest {
  /** Artifact of the run being repeated. The engine reads it, not us. */
  artifactPath: string
  /** Students with something left, for the sentence on screen. */
  students: number
  /** Checks that will actually be executed again. */
  checks: number
}

const savedTheme: Theme = localStorage.getItem('heimdall-theme') === 'light' ? 'light' : 'dark'
const savedScale: ScaleId =
  localStorage.getItem('heimdall-scale') === 'hundred' ? 'hundred' : DEFAULT_SCALE

/**
 * The `dark` class is written here, next to the state change, and not in an
 * effect: anything that reads CSS variables during render would otherwise
 * paint a whole frame with the previous theme's colours.
 *
 * The `document` guard is for the tests, which import this module under Node.
 */
function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
}
applyTheme(savedTheme)

export const useApp = create<AppState>((set, get) => ({
  theme: savedTheme,
  view: 'home',
  engine: null,
  examPath: null,
  classPath: null,
  notice: null,
  scale: savedScale,
  retry: null,

  setTheme: (theme) => {
    localStorage.setItem('heimdall-theme', theme)
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setView: (view) => set({ view }),
  setEngine: (engine) => set({ engine }),
  setExamPath: (examPath) => set({ examPath }),
  setClassPath: (classPath) => set({ classPath }),
  setNotice: (notice) => set({ notice }),
  setScale: (scale) => {
    localStorage.setItem('heimdall-scale', scale)
    set({ scale })
  },
  setRetry: (retry) => set({ retry })
}))

/**
 * What went wrong, in the sentence the main process wrote.
 *
 * Electron wraps anything a handler throws with «Error invoking remote method
 * 'x:y'», which names a channel the teacher has never heard of and buries the
 * reason at the end of the line. The reason is what goes on screen.
 */
export function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']*':\s*(Error:\s*)?/, '')
}

/** Turns anything thrown into a sentence the teacher can read. */
export function noticeFrom(prefix: string, error: unknown): string {
  return `${prefix}: ${messageOf(error)}`
}
