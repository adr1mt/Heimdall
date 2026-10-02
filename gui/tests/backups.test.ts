import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  MAX_BACKUPS,
  backupRuns,
  backupsRoot,
  listBackups,
  restoreBackups,
  slotFor
} from '../src/main/backup'
import { varDirOf } from '../src/main/history'
import { parseArtifact } from '../src/shared/artifact'
import { FROM_BACKUP, gradesOnly } from '../src/shared/backup'

const PASSWORD = 'contrasena-de-la-clase'

/**
 * An artifact the way the engine writes it: a grade, and under it the whole
 * output of the machine. The password is in that output on purpose — it is
 * what must never reach the copy.
 */
function artifact(runId: string, startedAt: string, score = 80): string {
  const run = {
    schema_version: 1,
    run_id: runId,
    engine_version: '0.1.0-dev',
    started_at: startedAt,
    finished_at: startedAt,
    status: 'COMPLETE',
    exam: { path: '/aula/examen.yaml', sha256: 'a'.repeat(64) },
    inventory: { path: '/aula/aula.yaml', sha256: 'b'.repeat(64) },
    plan_hash: 'c'.repeat(64),
    plan: {
      check_count: 1,
      total_weight: 1,
      check_ids: ['responde'],
      concurrency: 4,
      host_concurrency: 2
    },
    students: [
      {
        student_id: 'alu1',
        name: 'Alumna Primera',
        status: 'OK',
        started_at: startedAt,
        finished_at: startedAt,
        score: {
          obtained: 1,
          evaluable: 1,
          total: 1,
          unevaluated: 0,
          provisional_score: score,
          final_score: score,
          status: 'COMPLETE'
        },
        checks: [
          {
            check_id: 'responde',
            group: 'Primeras',
            description: 'La máquina responde',
            weight: 1,
            status: 'PASS',
            cause: 'NONE',
            execution: {
              host: 'host1',
              address: '127.1.2.3',
              user: 'alu1',
              transport: 'ssh',
              command: ['hostname'],
              started_at: startedAt,
              duration_ms: 12,
              completed: true,
              exit_code: 0,
              overflow: false,
              stdout: {
                text: `maquina1 ${PASSWORD}`,
                bytes: 30,
                bytes_total: 30,
                truncated: false
              },
              stderr: { text: '', bytes: 0, bytes_total: 0, truncated: false },
              connect_attempts: 1,
              command_attempts: 1,
              remote_process: 'FINISHED'
            },
            assertion: {
              kind: 'exit_code',
              expected: '0',
              found: `0 (${PASSWORD})`,
              matched: true
            }
          }
        ]
      }
    ]
  }
  // A published 80/73 needs failed weight as well as its successful check.
  const total=100/score
  run.plan.check_count=2;run.plan.total_weight=total;run.plan.check_ids.push('other')
  run.students[0].score.evaluable=total;run.students[0].score.total=total
  const first=run.students[0].checks[0]
  run.students[0].checks.push({...first,check_id:'other',weight:total-1,status:'FAIL',assertion:{...first.assertion,expected:'1',matched:false}})
  return JSON.stringify(run)

}

/** A project with its var/ and the data directory of the application. */
function workspace(): { dataDir: string; examPath: string; varDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'heimdall-backups-'))
  const project = join(root, '2smx-redes')
  const examPath = join(project, 'examen.yaml')
  mkdirSync(varDirOf(examPath), { recursive: true })
  writeFileSync(examPath, 'examen: "Redes"\n', 'utf-8')
  return { dataDir: join(root, 'datos'), examPath, varDir: varDirOf(examPath) }
}

function writeRun(varDir: string, runId: string, at: string, score = 80): void {
  writeFileSync(join(varDir, `run-${runId}.json`), artifact(runId, at, score), 'utf-8')
}

describe('gradesOnly', () => {
  it('keeps the grade and drops what the machines said', async () => {
    const run = gradesOnly(parseArtifact(artifact('R1', '2026-09-21T09:00:00Z')))
    expect(run.students[0].score.final_score).toBe(80)
    expect(run.students[0].checks[0].status).toBe('PASS')
    expect(run.students[0].checks[0].weight).toBe(1)
    expect(run.students[0].checks[0].execution).toBeNull()
    expect(run.students[0].checks[0].assertion).toBeNull()
  })

  it('says in the file itself that it came from a copy', async () => {
    const run = gradesOnly(parseArtifact(artifact('R1', '2026-09-21T09:00:00Z')))
    expect(run.warnings?.some((w) => w.code === FROM_BACKUP.code)).toBe(true)
  })

  it('leaves the original untouched', async () => {
    const original = parseArtifact(artifact('R1', '2026-09-21T09:00:00Z'))
    gradesOnly(original)
    expect(original.students[0].checks[0].execution).not.toBeNull()
  })
})

describe('backupRuns', () => {
  it('copies the grades outside the exam folder', async () => {
    const { dataDir, examPath } = workspace()
    writeRun(varDirOf(examPath), 'R1', '2026-09-21T09:00:00Z')
    expect((await backupRuns(dataDir, examPath)).saved).toBe(1)
    expect(slotFor(dataDir, examPath).startsWith(backupsRoot(dataDir))).toBe(true)
    expect(listBackups(dataDir, examPath)).toHaveLength(1)
  })

  it('does not copy the same correction twice', async () => {
    const { dataDir, examPath } = workspace()
    writeRun(varDirOf(examPath), 'R1', '2026-09-21T09:00:00Z')
    await backupRuns(dataDir, examPath)
    expect((await backupRuns(dataDir, examPath)).saved).toBe(0)
  })

  it('copies again the correction whose copy was deleted', async () => {
    const { dataDir, examPath } = workspace()
    writeRun(varDirOf(examPath), 'R1', '2026-09-21T09:00:00Z')
    await backupRuns(dataDir, examPath)
    rmSync(join(slotFor(dataDir, examPath), 'run-R1.json'))
    expect((await backupRuns(dataDir, examPath)).saved).toBe(1)
  })

  it('no password travels in the copy', async () => {
    const { dataDir, examPath } = workspace()
    writeRun(varDirOf(examPath), 'R1', '2026-09-21T09:00:00Z')
    await backupRuns(dataDir, examPath)
    const copy = readFileSync(join(slotFor(dataDir, examPath), 'run-R1.json'), 'utf-8')
    expect(copy).not.toContain(PASSWORD)
  })

  it('keeps the number of copies bounded', async () => {
    const { dataDir, examPath } = workspace()
    for (let i = 0; i < MAX_BACKUPS + 5; i += 1) {
      writeRun(varDirOf(examPath), `R${i}`, `2026-09-21T09:${String(i).padStart(2, '0')}:00Z`)
    }
    await backupRuns(dataDir, examPath)
    expect(listBackups(dataDir, examPath).length).toBeLessThanOrEqual(MAX_BACKUPS)
  })

  it('a broken artifact does not stop the rest', async () => {
    const { dataDir, examPath, varDir } = workspace()
    writeFileSync(join(varDir, 'run-ROTO.json'), 'esto no es un JSON', 'utf-8')
    writeRun(varDir, 'R1', '2026-09-21T09:00:00Z')
    expect((await backupRuns(dataDir, examPath)).saved).toBe(1)
  })

  it('two exams with the same folder name do not share their copies', async () => {
    const a = workspace()
    const b = workspace()
    expect(slotFor(a.dataDir, a.examPath)).not.toBe(slotFor(b.dataDir, b.examPath))
  })
})

describe('restoreBackups', () => {
  it('recovers the grades after the exam folder is deleted', async () => {
    const { dataDir, examPath, varDir } = workspace()
    writeRun(varDir, 'R1', '2026-09-21T09:00:00Z', 73)
    await backupRuns(dataDir, examPath)

    rmSync(varDir, { recursive: true, force: true })
    expect(restoreBackups(dataDir, examPath)).toEqual({ restored: 1, kept: 0 })

    const run = parseArtifact(readFileSync(join(varDir, 'run-R1.json'), 'utf-8'))
    expect(run.students[0].score.final_score).toBe(73)
    expect(run.students[0].name).toBe('Alumna Primera')
  })

  it('restoring lowers no grade already saved', async () => {
    const { dataDir, examPath, varDir } = workspace()
    writeRun(varDir, 'R1', '2026-09-21T09:00:00Z', 73)
    await backupRuns(dataDir, examPath)

    expect(restoreBackups(dataDir, examPath)).toEqual({ restored: 0, kept: 1 })
    // The artifact in the folder is the one the engine wrote, whole.
    const run = parseArtifact(readFileSync(join(varDir, 'run-R1.json'), 'utf-8'))
    expect(run.students[0].score.final_score).toBe(73)
    expect(run.students[0].checks[0].execution).not.toBeNull()
  })

  it('only the missing corrections come back', async () => {
    const { dataDir, examPath, varDir } = workspace()
    writeRun(varDir, 'R1', '2026-09-21T09:00:00Z')
    writeRun(varDir, 'R2', '2026-09-21T10:00:00Z')
    await backupRuns(dataDir, examPath)
    rmSync(join(varDir, 'run-R2.json'))
    expect(restoreBackups(dataDir, examPath)).toEqual({ restored: 1, kept: 1 })
  })

  it('says so when there is nothing to restore', async () => {
    const { dataDir, examPath } = workspace()
    expect(() => restoreBackups(dataDir, examPath)).toThrow(/copia de seguridad/)
  })
})

describe('listBackups', () => {
  it('newest correction first, and says which are only a copy', async () => {
    const { dataDir, examPath, varDir } = workspace()
    writeRun(varDir, 'R1', '2026-09-21T09:00:00Z')
    writeRun(varDir, 'R2', '2026-09-21T10:00:00Z')
    await backupRuns(dataDir, examPath)
    rmSync(join(varDir, 'run-R1.json'))

    const entries = listBackups(dataDir, examPath)
    expect(entries.map((entry) => entry.runId)).toEqual(['R2', 'R1'])
    expect(entries.map((entry) => entry.onDisk)).toEqual([true, false])
    expect(entries[0].students).toBe(1)
  })

  it('an exam with no copies is an empty list, not a failure', async () => {
    const { dataDir, examPath } = workspace()
    expect(listBackups(dataDir, examPath)).toEqual([])
  })
})

it.each([51,100])('retains the latest grades over three passes and restore (%i originals)', async (count) => {
 const {dataDir,examPath,varDir}=workspace()
 for(let i=1;i<=count;i++) writeRun(varDir,`R${String(i).padStart(3,'0')}`,new Date(Date.UTC(2026,9,2,0,i)).toISOString())
 await backupRuns(dataDir,examPath)
 const expected=listBackups(dataDir,examPath).map(x=>x.runId)
 expect(expected).toHaveLength(MAX_BACKUPS)
 expect(expected[0]).toBe(`R${String(count).padStart(3,'0')}`)
 for(let pass=0;pass<2;pass++) {
  expect((await backupRuns(dataDir,examPath)).saved).toBe(0)
  expect(listBackups(dataDir,examPath).map(x=>x.runId)).toEqual(expected)
 }
 rmSync(varDir,{recursive:true})
 expect(restoreBackups(dataDir,examPath).restored).toBe(MAX_BACKUPS)
 expect(listBackups(dataDir,examPath).every(x=>x.onDisk)).toBe(true)
})


it('reports an unwritable destination without failing the correction',async()=> {
 const {dataDir,examPath,varDir}=workspace()
 writeRun(varDir,'R1','2026-10-02T10:00:00Z')
 mkdirSync(dataDir,{recursive:true});writeFileSync(backupsRoot(dataDir),'cannot create directory here')
 const report=await backupRuns(dataDir,examPath)
 expect(report.saved).toBe(0);expect(report.failures.length).toBeGreaterThan(0)
 expect(readFileSync(join(varDir,'run-R1.json'),'utf8')).toContain('R1')
})
it('serializes overlapping passes for the same exam',async()=> {
 const {dataDir,examPath,varDir}=workspace();writeRun(varDir,'R1','2026-10-02T10:00:00Z')
 const reports=await Promise.all([backupRuns(dataDir,examPath),backupRuns(dataDir,examPath)])
 expect(reports.map(x=>x.saved)).toEqual([1,0]);expect(reports.every(x=>x.failures.length===0)).toBe(true)
})
