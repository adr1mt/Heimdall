// What the history screen knows about one past run, without opening it.
//
// It is a summary and never a grade: the grades of a run live in its artifact
// and are read only when the teacher opens it (ADR-0007).

import type { RunStatus } from './events'

export interface RunSummary {
  /** The artifact this row stands for. */
  path: string
  /**
   * When the run started, as the artifact says. When the artifact cannot be
   * read it is the file's own date, so the row still lands in its place.
   */
  at: string
  runId: string | null
  status: RunStatus | null
  /** File names, not full paths: what the teacher recognises at a glance. */
  exam: string | null
  classroom: string | null
  students: number | null
  checks: number | null
  /** The run this one repeated, when it was a retry. */
  retryOf: string | null
  /**
   * Why this artifact cannot be opened. A run that cannot be read still shows
   * up with its reason: dropping it would hide a correction that happened.
   */
  problem: string | null
}
