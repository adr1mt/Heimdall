/**
 * The sections of the application, in the order the teacher looks for them.
 *
 * The order is the one Teutón GUI had, which is the order of the work itself:
 * first what is going to be corrected (the class, the exam), then what came
 * out of it (results, analytics, history). Ajustes and Ayuda go to the foot
 * because they are not part of correcting anything.
 *
 * A section that is not built yet is shown disabled and never hidden: a menu
 * that grows entry by entry between versions is a menu nobody learns.
 */
export type View =
  | 'home'
  | 'classes'
  | 'exams'
  | 'correct'
  | 'results'
  | 'analytics'
  | 'history'
  | 'settings'
  | 'help'

import { t } from '@/i18n/es'

export interface NavEntry {
  id: View
  label: string
  /** False while the section is still to be built. */
  ready: boolean
  /**
   * True when the section makes no sense without an exam open: correcting,
   * its results and the history of the project are all about one exam. They
   * are shown disabled and never hidden, like a section still to be built.
   */
  needsProject?: boolean
}

export const NAV_MAIN: NavEntry[] = [
  { id: 'home', label: t.nav.home, ready: true },
  { id: 'classes', label: t.nav.classes, ready: true },
  { id: 'exams', label: t.nav.exams, ready: true, needsProject: true },
  { id: 'correct', label: t.nav.correct, ready: true, needsProject: true },
  { id: 'results', label: t.nav.results, ready: true, needsProject: true },
  { id: 'analytics', label: t.nav.analytics, ready: false },
  { id: 'history', label: t.nav.history, ready: true, needsProject: true }
]

export const NAV_FOOTER: NavEntry[] = [
  { id: 'settings', label: t.nav.settings, ready: true },
  { id: 'help', label: t.nav.help, ready: true }
]

const ENTRIES = [...NAV_MAIN, ...NAV_FOOTER]

/** Whether a section can be opened at all. */
export function isReady(view: View): boolean {
  return ENTRIES.find((entry) => entry.id === view)?.ready ?? false
}

/** Whether a section needs an exam open before it can be opened. */
export function needsProject(view: View): boolean {
  return ENTRIES.find((entry) => entry.id === view)?.needsProject === true
}

/**
 * Whether a section can be opened right now. Without an exam open, the ones
 * that are about an exam cannot: there is nothing to correct, no results and
 * no history, and landing on an empty screen explains none of that.
 */
export function canOpen(view: View, hasProject: boolean): boolean {
  return isReady(view) && (hasProject || !needsProject(view))
}

/** What a section that is not built yet promises, by name. */
export function comingSoon(view: View): string {
  return t.nav.soon(ENTRIES.find((entry) => entry.id === view)?.label ?? '')
}
