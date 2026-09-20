import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseArtifact } from '../shared/artifact'
import type { RunSummary } from '../shared/history'
import { MAX_ARTIFACT, tooBigMessage } from './artifact'

/**
 * A finished artifact. The partials a killed run leaves behind end in
 * `.partial.json` and are not runs that finished, so they stay out of the
 * list.
 */
const RUN_FILE = /^run-[A-Za-z0-9_-]+\.json$/

/**
 * How many runs the history goes back. A classroom directory accumulates one
 * artifact per correction and they are read in full to be summarised, so the
 * list is bounded instead of growing until it freezes the window. The oldest
 * ones stay on disk and can still be opened by hand.
 */
export const MAX_RUNS = 50

/** Where the engine writes the artifacts of a project (run.ts: `--var`). */
export function varDirOf(examPath: string): string {
  return join(dirname(examPath), 'var')
}

/**
 * The runs of one project, newest first. A directory that does not exist, or
 * holds nothing, is an empty history and not a failure: a project that has
 * never been corrected is an ordinary state.
 */
export async function listRuns(varDir: string): Promise<RunSummary[]> {
  let names: string[]
  try {
    names = await readdir(varDir)
  } catch {
    return []
  }

  const files: { path: string; mtimeMs: number; size: number }[] = []
  for (const name of names) {
    if (!RUN_FILE.test(name)) continue
    const path = join(varDir, name)
    try {
      const info = await stat(path)
      if (info.isFile()) files.push({ path, mtimeMs: info.mtimeMs, size: info.size })
    } catch {
      // It was there a moment ago and is not now. Nothing to report about a
      // file that no longer exists.
    }
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs)

  const runs: RunSummary[] = []
  for (const file of files.slice(0, MAX_RUNS)) {
    runs.push(await summarise(file.path, file.mtimeMs, file.size))
  }
  // The artifact's own clock, not the file's: a copied directory keeps the
  // order of the corrections and not the order they were copied in.
  runs.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return runs
}

async function summarise(path: string, mtimeMs: number, size: number): Promise<RunSummary> {
  const fallback: RunSummary = {
    path,
    at: new Date(mtimeMs).toISOString(),
    runId: null,
    status: null,
    exam: null,
    classroom: null,
    students: null,
    checks: null,
    retryOf: null,
    problem: null
  }

  if (size > MAX_ARTIFACT) return { ...fallback, problem: tooBigMessage(size) }

  try {
    const run = parseArtifact(await readFile(path, 'utf-8'))
    return {
      path,
      at: run.started_at || fallback.at,
      runId: run.run_id,
      status: run.status,
      exam: baseName(run.exam?.path),
      classroom: baseName(run.inventory?.path),
      students: run.students.length,
      checks: run.plan.check_count,
      retryOf: run.retry_of?.run_id ?? null,
      problem: null
    }
  } catch (error) {
    return { ...fallback, problem: error instanceof Error ? error.message : String(error) }
  }
}

function baseName(path: string | undefined): string | null {
  if (!path) return null
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}
