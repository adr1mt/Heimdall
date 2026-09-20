import { create } from 'zustand'
import type { EngineStatus } from '../../../shared/types'

export type View = 'home' | 'settings' | 'help'
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

  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setView: (view: View) => void
  setEngine: (engine: EngineStatus) => void
  setExamPath: (path: string | null) => void
  setClassPath: (path: string | null) => void
  setNotice: (message: string | null) => void
}

const savedTheme: Theme = localStorage.getItem('heimdall-theme') === 'light' ? 'light' : 'dark'

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
  setNotice: (notice) => set({ notice })
}))

/** Turns anything thrown into a sentence the teacher can read. */
export function noticeFrom(prefix: string, error: unknown): string {
  return `${prefix}: ${error instanceof Error ? error.message : String(error)}`
}
