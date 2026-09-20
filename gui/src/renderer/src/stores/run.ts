import { create } from 'zustand'
import type { RunResult } from '../../../shared/artifact'
import type { EngineEvent } from '../../../shared/events'
import type { RunClosed } from '../../../shared/types'
import { applyClosed, applyEvent, emptyRunState, type RunState } from '@/lib/run-state'

interface RunStore extends RunState {
  /** The canonical artifact of the finished run: the source of truth. */
  artifact: RunResult | null
  /** Where that artifact lives, so a retry can name it to the engine. */
  artifactPath: string | null
  /** Why the artifact could not be opened, if that happened. */
  artifactProblem: string | null
  setArtifact: (artifact: RunResult, path: string) => void
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
  artifactPath: null,
  artifactProblem: null,

  setArtifact: (artifact, artifactPath) => set({ artifact, artifactPath, artifactProblem: null }),
  artifactFailed: (artifactProblem) => set({ artifactProblem }),

  begin: () =>
    set({ ...emptyRunState(), phase: 'starting', artifact: null, artifactPath: null, artifactProblem: null }),
  event: (event) => set((state) => applyEvent(state, event)),
  closed: (closed) => set((state) => applyClosed(state, closed)),
  cancelRequested: () => set({ cancelling: true }),
  fail: (problem) => set({ phase: 'finished', cancelling: false, problem }),
  reset: () => set({ ...emptyRunState(), artifact: null, artifactPath: null, artifactProblem: null })
}))
