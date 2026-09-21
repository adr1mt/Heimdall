import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parseArtifact } from '../shared/artifact'
import { gradesOnly, type BackupEntry, type RestoreReport } from '../shared/backup'
import { MAX_ARTIFACT } from './artifact'
import { RUN_FILE, varDirOf } from './history'

/**
 * How many copies one exam keeps. The same number the history shows: a copy
 * of a correction nobody can list is a copy nobody restores, and a directory
 * that grows without end is not a backup, it is a leak.
 */
export const MAX_BACKUPS = 50

/** Where every copy lives: the app's own data directory, never the exam's. */
export function backupsRoot(dataDir: string): string {
  return join(dataDir, 'copias')
}

/**
 * The folder of one exam's copies. Named after the exam's folder so it can be
 * recognised by hand, and closed with a digest of the full path so two
 * «2smx-redes» in different places never share a slot.
 */
export function slotFor(dataDir: string, examPath: string): string {
  const dir = varDirOf(examPath)
  const digest = createHash('sha256').update(dir).digest('hex').slice(0, 12)
  const slug = basename(join(dir, '..')).replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 40) || 'examen'
  return join(backupsRoot(dataDir), `${slug}-${digest}`)
}

function runFilesIn(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => RUN_FILE.test(name))
  } catch {
    return []
  }
}

/** Atomic: a power cut never leaves a half-written copy of a class's grades. */
function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, text, 'utf-8')
  renameSync(tmp, path)
}

/**
 * Copies the corrections of an exam that are not copied yet. It is called
 * after every correction, so the copy of a run is made the moment it exists,
 * and it repairs itself: a run whose copy was deleted is copied again on the
 * next pass.
 *
 * It never throws. A backup that fails must not take down the correction that
 * just finished; what it could not copy comes back as a count.
 */
export function backupRuns(dataDir: string, examPath: string): number {
  const varDir = varDirOf(examPath)
  const slot = slotFor(dataDir, examPath)
  let saved = 0
  for (const name of runFilesIn(varDir)) {
    const target = join(slot, name)
    if (existsSync(target)) continue
    try {
      const source = join(varDir, name)
      if (statSync(source).size > MAX_ARTIFACT) continue
      const run = parseArtifact(readFileSync(source, 'utf-8'))
      mkdirSync(slot, { recursive: true })
      writeAtomic(target, `${JSON.stringify(gradesOnly(run))}\n`)
      saved += 1
    } catch {
      // An artifact that cannot be read is not copied. It is still on disk
      // and the history screen already says why it cannot be opened.
    }
  }
  prune(slot)
  return saved
}

/** Drops the oldest copies past the cap. The newest are the ones that matter. */
function prune(slot: string): void {
  const files = runFilesIn(slot)
  if (files.length <= MAX_BACKUPS) return
  const dated = files
    .map((name) => {
      try {
        return { name, mtimeMs: statSync(join(slot, name)).mtimeMs }
      } catch {
        return null
      }
    })
    .filter((file): file is { name: string; mtimeMs: number } => file !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
  for (const file of dated.slice(MAX_BACKUPS)) {
    try {
      rmSync(join(slot, file.name))
    } catch {
      // Already gone. Nothing to report about a file that is not there.
    }
  }
}

/** The copies of one exam, newest correction first. */
export function listBackups(dataDir: string, examPath: string): BackupEntry[] {
  const slot = slotFor(dataDir, examPath)
  const varDir = varDirOf(examPath)
  const entries: BackupEntry[] = []
  for (const name of runFilesIn(slot)) {
    const path = join(slot, name)
    try {
      const run = parseArtifact(readFileSync(path, 'utf-8'))
      entries.push({
        path,
        runId: run.run_id,
        at: run.started_at,
        students: run.students.length,
        onDisk: existsSync(join(varDir, name))
      })
    } catch {
      // A copy that cannot be read is not a copy. It is skipped instead of
      // offering the teacher a restore that would write nothing.
    }
  }
  entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return entries
}

/**
 * Puts the copies back into the exam's folder. A correction already there is
 * left exactly as it is: the artifact on disk holds the whole evidence and
 * the copy holds only the grades, so overwriting it would lower what the
 * teacher has. Restoring can only add corrections, never replace one.
 */
export function restoreBackups(dataDir: string, examPath: string): RestoreReport {
  const slot = slotFor(dataDir, examPath)
  const varDir = varDirOf(examPath)
  const report: RestoreReport = { restored: 0, kept: 0 }
  const names = runFilesIn(slot)
  if (names.length === 0) throw new Error('No hay ninguna copia de seguridad de este examen.')
  for (const name of names) {
    const target = join(varDir, name)
    if (existsSync(target)) {
      report.kept += 1
      continue
    }
    const text = readFileSync(join(slot, name), 'utf-8')
    // Read before writing: a copy that is not an artifact is not restored.
    parseArtifact(text)
    mkdirSync(varDir, { recursive: true })
    writeAtomic(target, text)
    report.restored += 1
  }
  return report
}
