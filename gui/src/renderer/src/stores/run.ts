import { create } from 'zustand'
import type { RunResult } from '../../../shared/artifact'
import type { EngineEvent } from '../../../shared/events'
import type { RunClosed } from '../../../shared/types'
import { applyClosed, applyEvent, emptyRunState, type RunState } from '@/lib/run-state'

interface RunStore extends RunState {
  /** The canonical artifact of the finished run: the source of truth. */
  artifact: RunResult | null
  /** Why the artifact could not be opened, if that happened. */
  artifactProblem: string | null
  setArtifact: (artifact: RunResult) => void
  artifactFailed: (problem: string) => void
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
  artifact: null,
  artifactProblem: null,

  setArtifact: (artifact) => set({ artifact, artifactProblem: null }),
  artifactFailed: (artifactProblem) => set({ artifactProblem }),

  begin: () => set({ ...emptyRunState(), phase: 'starting', artifact: null, artifactProblem: null }),
  event: (event) => set((state) => applyEvent(state, event)),
  closed: (closed) => set((state) => applyClosed(state, closed)),
  cancelRequested: () => set({ cancelling: true }),
  fail: (problem) => set({ phase: 'finished', cancelling: false, problem }),
  reset: () => set({ ...emptyRunState(), artifact: null, artifactProblem: null })
}))
