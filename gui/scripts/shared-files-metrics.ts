// Measure the actual GUI reader and backup path for T175; no Electron needed.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'
import { readArtifact } from '../src/main/artifact'
import { backupRuns, slotFor } from '../src/main/backup'

const project = process.argv[2]
if (!project) throw new Error('Expected benchmark project directory')
const original = readdirSync(join(project, 'var')).find(name => /^run-.*\.json$/.test(name) && !name.includes('partial'))
if (!original) throw new Error('Benchmark run missing')
const data = mkdtempSync(join(tmpdir(), 'heimdall-file-metrics-'))
try {
  let start = performance.now()
  const run = readArtifact(join(project, 'var', original))
  const readMs = performance.now() - start
  if (run.students.length !== 30 || run.students.some(s => s.checks.length !== 15)) throw new Error('Checks missing')
  start = performance.now()
  const created = await backupRuns(data, join(project, 'examen.yaml'))
  const createMs = performance.now() - start
  if (created.saved !== 1 || created.failures.length) throw new Error(JSON.stringify(created))
  start = performance.now()
  const rescanned = await backupRuns(data, join(project, 'examen.yaml'))
  const rescanMs = performance.now() - start
  if (rescanned.saved !== 0 || rescanned.failures.length) throw new Error(JSON.stringify(rescanned))
  const copy = readArtifact(join(slotFor(data, join(project, 'examen.yaml')), original))
  const grades = (result: typeof run): unknown => result.students.map(s => ({
    student: s.student_id, score: s.score,
    checks: s.checks.map(c => ({ id: c.check_id, status: c.status, cause: c.cause, weight: c.weight }))
  }))
  if (JSON.stringify(grades(run)) !== JSON.stringify(grades(copy))) throw new Error('Backup changed grades')
  if (copy.students.some(s => s.checks.some(c => c.execution !== null || c.assertion !== null))) throw new Error('Backup retained machine output')
  console.log(JSON.stringify({ read_ms: readMs, create_backup_ms: createMs, rescan_backups_ms: rescanMs }))
} finally { rmSync(data, { recursive: true, force: true }) }
