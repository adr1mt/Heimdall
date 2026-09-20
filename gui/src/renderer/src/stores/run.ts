import { create } from 'zustand'
import type { EngineEvent } from '../../../shared/events'
import type { RunClosed } from '../../../shared/types'
import { applyClosed, applyEvent, emptyRunState, type RunState } from '@/lib/run-state'

interface RunStore extends RunState {
  /** The engine has been asked to start; nothing has arrived yet. */
  begin: () => void
  event: (event: EngineEvent) => void
  closed: (closed: RunClosed) => void
  cancelRequested: () => void
  fail: (problem: string) => void
  reset: () => void
}

export const useRun = create<RunStore>((set) => ({
  ...emptyRunState(),

  begin: () => set({ ...emptyRunState(), phase: 'starting' }),
  event: (event) => set((state) => applyEvent(state, event)),
  closed: (closed) => set((state) => applyClosed(state, closed)),
  cancelRequested: () => set({ cancelling: true }),
  fail: (problem) => set({ phase: 'finished', cancelling: false, problem }),
  reset: () => set(emptyRunState())
}))
