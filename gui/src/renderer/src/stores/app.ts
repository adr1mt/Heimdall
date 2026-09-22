import { create } from 'zustand'
import type { EngineStatus, OpenProject } from '../../../shared/types'
import { DEFAULT_SCALE, type ScaleId } from '@/lib/export'
import { DEFAULT_PASS_MARK } from '@/lib/summary'
import {
  EXAM_OFF,
  examStarted,
  examStopped,
  passFinished,
  passStarted,
  type ExamMode
} from '@/lib/exam'

import { canOpen, type View } from '@/lib/nav'

export type { View }
export type Theme = 'dark' | 'light'

interface AppState {
  theme: Theme
  view: View
  /** null while the engine has not been looked for yet. */
  engine: EngineStatus | null
  /**
   * The project that is open: a folder with an exam in it. The teacher opens
   * it from Inicio and never chooses a file; everything that is about one
   * exam —corregir, resultados, histórico— hangs off this.
   */
  project: OpenProject | null
  /**
   * The class the teacher is correcting, by its identifier. The students and
   * the name live in the saved classes (ADR-0021); what is remembered here is
   * only which one was chosen last.
   */
  classId: string | null
  /** One operational notice on screen, or null. */
  notice: string | null
  /**
   * The version that is downloaded and waiting for the application to close,
   * or null. It is news, not a problem: it changes nothing and it is never
   * shown on the projector.
   */
  update: string | null
  /**
   * The scale the teacher marks in. It only affects what is exported: the
   * artifact keeps the engine's 0-100 whatever this says.
   */
  scale: ScaleId
  /**
   * The mark from which the teacher counts a grade as a pass, over the 0-100
   * the engine publishes. It only decides what the class summary counts: no
   * grade changes, and an artifact never learns about it.
   */
  passMark: number
  /**
   * The correction the next run repeats, when the teacher asked for it. Null
   * is the ordinary case and also the default: leaving an incomplete pending
   * is the safe action and nothing here happens on its own (ADR-0018 §1).
   */
  retry: RetryRequest | null
  /**
   * Projector mode: everything a quarter bigger and the machine data covered.
   * It is a preference of this computer and it changes nothing that is
   * corrected, exported or written to disk.
   */
  projector: boolean
  /** Exam mode: the class is corrected again and again while it is on. */
  exam: ExamMode
  /**
   * The artifacts of the rounds of the exam going on, oldest first.
   *
   * They are the session, and the only thing the interface keeps of it: the
   * grade that counts, which round it comes from and who has finished are
   * asked of the engine with this list (ADR-0020, principio 12).
   */
  examRounds: string[]

  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setView: (view: View) => void
  setEngine: (engine: EngineStatus) => void
  setProject: (project: OpenProject | null) => void
  setClassId: (id: string | null) => void
  setNotice: (message: string | null) => void
  setUpdate: (version: string | null) => void
  setScale: (scale: ScaleId) => void
  setPassMark: (mark: number) => void
  setRetry: (retry: RetryRequest | null) => void
  toggleProjector: () => void
  startExam: (everyMinutes: number) => void
  stopExam: () => void
  /** A pass has just been launched; the next one is due when it ends. */
  examPassStarted: () => void
  /** The engine is gone: schedule the next pass, if the mode is still on. */
  examPassFinished: () => void
  /** A round of the exam left its artifact; it joins the session. */
  examRoundFinished: (artifactPath: string) => void
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
const savedProjector = localStorage.getItem('heimdall-projector') === '1'
const savedClassId = localStorage.getItem('heimdall-class-id')
const savedPassMark = readPassMark(localStorage.getItem('heimdall-pass-mark'))

/**
 * The saved mark, or the default when there is none.
 *
 * Nothing saved is not a zero: `Number(null)` is 0, and that turned the first
 * run on a new computer into a class where everybody passed.
 */
function readPassMark(saved: string | null): number {
  if (saved === null || saved.trim() === '') return DEFAULT_PASS_MARK
  return clampMark(Number(saved))
}

/** A mark outside 0-100 is not a mark: the saved value is never trusted. */
function clampMark(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PASS_MARK
  return Math.min(100, Math.max(0, Math.round(value)))
}

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

/**
 * The projector size is a change of the document's base type size, not of
 * every rule in the interface: `rem` does the rest on its own.
 */
function applyProjector(on: boolean): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('projector', on)
  }
}
applyProjector(savedProjector)

export const useApp = create<AppState>((set, get) => ({
  theme: savedTheme,
  view: 'home',
  engine: null,
  project: null,
  classId: savedClassId,
  notice: null,
  update: null,
  scale: savedScale,
  passMark: savedPassMark,
  retry: null,
  projector: savedProjector,
  exam: EXAM_OFF,
  examRounds: [],

  setTheme: (theme) => {
    localStorage.setItem('heimdall-theme', theme)
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  // A section that is not built yet, or that needs an exam there is not,
  // cannot be opened whoever asks: the button is disabled, and this is the
  // second lock so no code path lands the teacher on an empty screen.
  setView: (view) => set(canOpen(view, get().project !== null) ? { view } : {}),
  setEngine: (engine) => set({ engine }),
  // Changing project leaves nothing of the previous one behind: its rounds
  // are another exam's session and its pending retry another exam's, and
  // reading them together would grade the wrong exam. With an exam open the
  // next thing is correcting it; with none, Inicio is the only section left.
  setProject: (project) =>
    set({
      project,
      retry: null,
      examRounds: [],
      exam: EXAM_OFF,
      view: project ? 'correct' : 'home'
    }),
  setClassId: (classId) => {
    if (classId) localStorage.setItem('heimdall-class-id', classId)
    else localStorage.removeItem('heimdall-class-id')
    set({ classId })
  },
  setNotice: (notice) => set({ notice }),
  setUpdate: (update) => set({ update }),
  setScale: (scale) => {
    localStorage.setItem('heimdall-scale', scale)
    set({ scale })
  },
  setPassMark: (mark) => {
    const passMark = clampMark(mark)
    localStorage.setItem('heimdall-pass-mark', String(passMark))
    set({ passMark })
  },
  setRetry: (retry) => set({ retry }),

  toggleProjector: () => {
    const projector = !get().projector
    localStorage.setItem('heimdall-projector', projector ? '1' : '0')
    applyProjector(projector)
    set({ projector })
  },

  // A new exam is a new session: the rounds of the previous one are not
  // part of it and reading them together would grade the wrong exam.
  startExam: (everyMinutes) => set({ exam: examStarted(everyMinutes, Date.now()), examRounds: [] }),
  stopExam: () => set({ exam: examStopped(get().exam) }),
  examPassStarted: () => set({ exam: passStarted(get().exam) }),
  examPassFinished: () => set({ exam: passFinished(get().exam, Date.now()) }),
  examRoundFinished: (artifactPath) =>
    set((state) =>
      state.examRounds.includes(artifactPath)
        ? state
        : { examRounds: [...state.examRounds, artifactPath] }
    )
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
