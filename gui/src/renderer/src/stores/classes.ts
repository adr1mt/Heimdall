import { create } from 'zustand'
import type { ClassGroup } from '../../../shared/classes'
import { messageOf } from './app'

/**
 * The teacher's classes, as the interface holds them.
 *
 * The whole list travels on every save: it is twenty-something students that
 * fit in a breath, and one write of the whole thing cannot leave two classes
 * disagreeing with each other (ADR-0021 §2).
 *
 * `problem` is not a cosmetic detail. While the file on disk cannot be read,
 * nothing is saved and the screen says why: an empty list would read as «you
 * have no classes» and the next save would make that true (ADR-0021 §5).
 */
interface ClassesState {
  groups: ClassGroup[]
  /** Why the classes cannot be read, or null. Blocks saving while it is set. */
  problem: string | null
  loaded: boolean
  load: () => Promise<void>
  /** Saves the list and keeps it, or leaves everything as it was and throws. */
  save: (groups: ClassGroup[]) => Promise<void>
}

export const useClasses = create<ClassesState>((set, get) => ({
  groups: [],
  problem: null,
  loaded: false,

  load: async () => {
    try {
      const groups = await window.heimdall.listClasses()
      set({ groups, problem: null, loaded: true })
    } catch (error) {
      set({ groups: [], problem: messageOf(error), loaded: true })
    }
  },

  save: async (groups) => {
    if (get().problem) throw new Error(get().problem as string)
    await window.heimdall.saveClasses(groups)
    set({ groups })
  }
}))

/** The chosen class, or null when there is none or it is gone. */
export function groupById(groups: ClassGroup[], id: string | null): ClassGroup | null {
  if (!id) return null
  return groups.find((group) => group.id === id) ?? null
}
