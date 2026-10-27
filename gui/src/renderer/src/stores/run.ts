import { create } from 'zustand'
import type { RunResult } from '../../../shared/artifact'
import type { EngineEvent } from '../../../shared/events'
import type { RunClosed } from '../../../shared/types'
import { applyClosed, applyEvent, emptyRunState, type RunState } from '@/lib/run-state'
import { useResultsView } from './results-view'

interface RunStore extends RunState {
  revision: number
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
  revision: 0,
  artifact: null,
  artifactPath: null,
  artifactProblem: null,

  setArtifact: (artifact, artifactPath) => {
    useResultsView.getState().bindSources(artifact.exam.path, artifact.inventory.path)
    set({ artifact, artifactPath, artifactProblem: null, problem: null })
  },
  artifactFailed: (artifactProblem) => set({ artifactProblem }),

  begin: () =>
    set((state) => ({ ...emptyRunState(), revision: state.revision + 1, phase: 'starting', artifactProblem: null })),
  event: (event) => set((state) => applyEvent(state, event)),
  closed: (closed) => set((state) => applyClosed(state, closed)),
  cancelRequested: () => set({ cancelling: true }),
  fail: (problem) => set({ phase: 'finished', cancelling: false, problem }),
  reset: () => set((state) => ({ ...emptyRunState(), revision: state.revision + 1, artifact: null, artifactPath: null, artifactProblem: null }))
}))
