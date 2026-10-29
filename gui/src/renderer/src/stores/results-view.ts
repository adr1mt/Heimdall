import { create } from 'zustand'
import { NO_FILTERS, type Filters, type StudentFilter, type StudentOrder } from '@/lib/results'

interface ResultsViewState {
  checkWidth: number | null
  setCheckWidth: (width: number | null) => void
  projectorZoom: number
  projectorFit: boolean
  setProjectorScale: (zoom: number, fit: boolean) => void
  scope: string | null
  filters: Filters
  studentFilter: StudentFilter
  order: StudentOrder
  mode: 'list' | 'matrix'
  hiddenIds: string[]
  setFilters: (filters: Filters) => void
  setStudentFilter: (filter: StudentFilter) => void
  setOrder: (order: StudentOrder) => void
  setMode: (mode: 'list' | 'matrix') => void
  hideStudent: (id: string) => void
  showStudent: (id: string) => void
  showAll: () => void
  clearFilters: () => void
  bindSources: (examPath: string, inventoryPath: string) => void
  reset: () => void
}

const defaults = () => ({
  checkWidth: null as number | null,
  projectorZoom: 1,
  projectorFit: false,
  scope: null as string | null,
  filters: { ...NO_FILTERS },
  studentFilter: 'all' as StudentFilter,
  order: 'name' as StudentOrder,
  mode: 'list' as const,
  hiddenIds: [] as string[]
})

// Presentation only: never persisted or passed to a correction or export.
export const useResultsView = create<ResultsViewState>((set, get) => ({
  ...defaults(),
  setCheckWidth: (width) => set({ checkWidth: width === null ? null : Math.max(160, Math.min(800, Math.round(width))) }),
  setProjectorScale: (projectorZoom, projectorFit) => set({ projectorZoom, projectorFit }),
  setFilters: (filters) => set({ filters }),
  setStudentFilter: (studentFilter) => set({ studentFilter }),
  setOrder: (order) => set({ order }),
  setMode: (mode) => set({ mode }),
  hideStudent: (id) => set((state) => ({ hiddenIds: [...new Set([...state.hiddenIds, id])] })),
  showStudent: (id) => set((state) => ({ hiddenIds: state.hiddenIds.filter((hidden) => hidden !== id) })),
  showAll: () => set({ hiddenIds: [] }),
  clearFilters: () => set({ filters: { ...NO_FILTERS }, studentFilter: 'all', order: 'name' }),
  // Paths identify the source class and exam, even when opening history.
  // A new run or a changed source hash must not bring absent students back.
  bindSources: (examPath, inventoryPath) => {
    const scope = JSON.stringify([examPath, inventoryPath])
    if (get().scope === null) set({ scope })
    else if (get().scope !== scope) set({ ...defaults(), scope })
  },
  reset: () => set(defaults())
}))
