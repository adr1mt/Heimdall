import { create } from 'zustand'
import type { SavedExam } from '../../../shared/exam-record'

interface State {
  saved: SavedExam | null
  problem: string | null
  loading: boolean
  finishing: boolean
  prompt: boolean
  key: string
  load: (path: string, classId: string, id?: string) => Promise<SavedExam | null>
  accept: (saved: SavedExam) => void
  reset: () => void
}

let revision = 0
export const useExamRecord = create<State>((set) => ({
  saved: null, problem: null, loading: false, finishing: false, prompt: false, key: '',
  load: async (path, classId, id) => {
    const token = ++revision
    const key = `${path}\n${classId}`
    set(state => ({ key, loading: true, ...(state.key !== key ? { saved: null, problem: null } : {}) }))
    try {
      const saved = await window.heimdall.savedExam(path, classId, id)
      if (token !== revision) return null
      set({ saved, problem: null, loading: false })
      return saved
    } catch (error) {
      if (token === revision) set({ saved: null, problem: error instanceof Error ? error.message : String(error), loading: false })
      throw error
    }
  },
  accept: saved => { revision++; set({ saved, problem: null, loading: false }) },
  reset: () => { revision++; set({ saved: null, problem: null, loading: false, finishing: false, prompt: false, key: '' }) }
}))
