import { readdir, stat, open } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { classNameOf } from '../shared/aula'
import type { ClassGroup } from '../shared/classes'
import type { RunSummary } from '../shared/history'
import { readArtifactAsync } from './artifact'

/**
 * A finished artifact. The partials a killed run leaves behind end in
 * `.partial.json` and are not runs that finished, so they stay out of the
 * list.
 */
export const RUN_FILE = /^run-[A-Za-z0-9_-]+\.json$/

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
export async function listRuns(varDir: string, classes: ClassGroup[] = []): Promise<RunSummary[]> {
  let names: string[]
  try {
    names = await readdir(varDir)
  } catch {
    return []
  }

  const files: { path: string; mtimeMs: number; at: number; problem?: string }[] = []
  for (const name of names) {
    if (!RUN_FILE.test(name)) continue
    const path = join(varDir, name)
    try {
      const info = await stat(path)
      if (info.isFile()) {
        try { files.push({ path, mtimeMs: info.mtimeMs, at: await readRunDate(path) }) }
        catch (error) { files.push({ path, mtimeMs: info.mtimeMs, at: NaN, problem: error instanceof Error ? error.message : String(error) }) }
      }
    } catch {
      // It was there a moment ago and is not now. Nothing to report about a
      // file that no longer exists.
    }
  }

  const dated = files.filter(file => Number.isFinite(file.at)).sort((a,b) => b.at-a.at || b.path.localeCompare(a.path))

  const runs: RunSummary[] = []
  for (const file of dated.slice(0, MAX_RUNS)) {
    runs.push(await summarise(file.path, file.mtimeMs, classes))
  }
  // The artifact's own clock, not the file's: a copied directory keeps the
  // order of the corrections and not the order they were copied in.
  runs.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  // Header errors do not push valid recent corrections out of the list.
  const problems = files.filter(file => file.problem).sort((a,b)=>b.mtimeMs-a.mtimeMs)
  for (const file of problems.slice(0, MAX_RUNS)) {
    runs.push({path:file.path,at:new Date(file.mtimeMs).toISOString(),runId:null,status:null,exam:null,classroom:null,students:null,checks:null,retryOf:null,problem:file.problem!})
  }
  if (problems.length > MAX_RUNS) runs.push({path:varDir,at:new Date(0).toISOString(),runId:null,status:null,exam:null,classroom:null,students:null,checks:null,retryOf:null,problem:`Hay ${problems.length-MAX_RUNS} errores de lectura adicionales en esta carpeta.`})
  return runs
}

async function summarise(
  path: string,
  mtimeMs: number,
  classes: ClassGroup[]
): Promise<RunSummary> {
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

  try {
    const run = await readArtifactAsync(path)
    return {
      path,
      at: run.started_at || fallback.at,
      runId: run.run_id,
      status: run.status,
      exam: baseName(run.exam?.path),
      // The class by its name, never «aula-heimdall-<id>.yaml»: the teacher
      // corrected «2SMX A», and the file is an artifact of ours (ADR-0022).
      classroom: classNameOf(baseName(run.inventory?.path), classes),
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

/** Canonical dates are in the engine's first 4096 bytes, also used by backups. */
export async function readRunDate(path: string): Promise<number> {
  const file = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(4096), { bytesRead } = await file.read(buffer,0,buffer.length,0)
    const match = buffer.toString('utf8',0,bytesRead).match(/"started_at"\s*:\s*"([^"\r\n]+)"/)
    const at = match ? Date.parse(match[1]) : NaN
    if (!Number.isFinite(at)) throw new Error('El resultado no tiene una fecha de corrección legible en la cabecera.')
    return at
  } finally { await file.close() }
}
