import { describe, expect, it } from 'vitest'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  it('keeps the exact grades and provenance on a second pass', async () => {
    const { dataDir, examPath, varDir } = workspace()
    const run = parseArtifact(artifact('R1', '2026-09-21T09:00:00Z', 73))
    run.warnings = [{ scope: 'run', code: 'SOURCE_WARNING', message: 'Aviso original' }]
    const original = JSON.stringify(run)
    const source = join(varDir, 'run-R1.json')
    const target = join(slotFor(dataDir, examPath), 'run-R1.json')
    writeFileSync(source, original)

    expect((await backupRuns(dataDir, examPath)).saved).toBe(1)
    const expected = `${JSON.stringify(gradesOnly(run))}\n`
    expect(readFileSync(target, 'utf8')).toBe(expected)
    expect((await backupRuns(dataDir, examPath)).saved).toBe(0)
    expect(readFileSync(target, 'utf8')).toBe(expected)
    expect(readFileSync(source, 'utf8')).toBe(original)
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

  it.skipIf(process.getuid?.() === 0)('reports an unreadable copy directory instead of claiming it is empty', () => {
    const { dataDir, examPath } = workspace()
    const slot = slotFor(dataDir, examPath)
    mkdirSync(slot, { recursive: true })
    chmodSync(slot, 0o000)
    try {
      expect(() => listBackups(dataDir, examPath)).toThrow(slot)
      expect(() => listBackups(dataDir, examPath)).toThrow(/EACCES/)
      expect(() => restoreBackups(dataDir, examPath)).toThrow(slot)
    } finally {
      chmodSync(slot, 0o700)
    }
  })

  it('shows valid copies beside a corrupt one and restores only valid grades', () => {
    const { dataDir, examPath, varDir } = workspace()
    const slot = slotFor(dataDir, examPath)
    mkdirSync(slot, { recursive: true })
    const good = JSON.stringify(gradesOnly(parseArtifact(artifact('GOOD', '2026-09-21T09:00:00Z'))))
    writeFileSync(join(slot, 'run-GOOD.json'), good)
    writeFileSync(join(slot, 'run-BROKEN.json'), '{broken')

    const rows = listBackups(dataDir, examPath)
    expect(rows.some(row => row.runId === 'GOOD' && !row.problem)).toBe(true)
    const broken = rows.find(row => row.path === join(slot, 'run-BROKEN.json'))
    expect(broken?.problem).toContain(join(slot, 'run-BROKEN.json'))
    expect(broken?.problem).toMatch(/resultado|JSON/i)
    expect(broken?.runId).toBeNull()

    const report = restoreBackups(dataDir, examPath)
    expect(report).toMatchObject({ restored: 1, kept: 0 })
    expect(report.problems?.[0]).toContain('run-BROKEN.json')
    expect(readFileSync(join(varDir, 'run-GOOD.json'), 'utf8')).toBe(good)
    expect(() => readFileSync(join(varDir, 'run-BROKEN.json'))).toThrow()
    expect(readFileSync(join(slot, 'run-BROKEN.json'), 'utf8')).toBe('{broken')
  })

  it('names the bad file when no copy can be restored', () => {
    const { dataDir, examPath } = workspace()
    const slot = slotFor(dataDir, examPath)
    mkdirSync(slot, { recursive: true })
    writeFileSync(join(slot, 'run-BROKEN.json'), '{broken')
    expect(() => restoreBackups(dataDir, examPath)).toThrow(/run-BROKEN\.json/)
    expect(listBackups(dataDir, examPath).some(row => row.problem?.includes('run-BROKEN.json'))).toBe(true)
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

it.each([2, 4])('retains complete chains through rotations and recovery (%i links)', async links => {
 const {dataDir,examPath,varDir}=workspace()
 const root='2026-09-01T10:00:00Z'
 writeRun(varDir,'ROOT',root)
 for(let i=0;i<60;i++) writeRun(varDir,`I${i}`,new Date(Date.UTC(2026,9,2,0,i)).toISOString())
 let previous='ROOT'
 for(let i=1;i<links;i++) {
  const run=JSON.parse(artifact(`RETRY${i}`,new Date(Date.UTC(2026,9,2,2,i)).toISOString()))
  run.retry_of={run_id:previous,artifact:join(varDir,`run-${previous}.json`),run_at:root,students:1,checks:1}
  writeFileSync(join(varDir,`run-RETRY${i}.json`),JSON.stringify(run));previous=`RETRY${i}`
 }
 for(let pass=0;pass<3;pass++) {
  expect((await backupRuns(dataDir,examPath)).failures).toEqual([])
  const ids=listBackups(dataDir,examPath).map(x=>x.runId)
  expect(ids).toContain('ROOT')
  for(let i=1;i<links;i++) expect(ids).toContain(`RETRY${i}`)
  expect(ids.length).toBeLessThanOrEqual(MAX_BACKUPS+links-1)
 }
 rmSync(varDir,{recursive:true});restoreBackups(dataDir,examPath)
 // Every offered chain can now be followed using only the restored files.
 for(const entry of listBackups(dataDir,examPath)) {
  let run=parseArtifact(readFileSync(join(varDir,`run-${entry.runId}.json`),'utf8'))
  while(run.retry_of) run=parseArtifact(readFileSync(join(varDir,`run-${run.retry_of.run_id}.json`),'utf8'))
 }
})
it('reports and hides a chain with a missing ancestor',async()=> {
 const {dataDir,examPath,varDir}=workspace(),run=JSON.parse(artifact('RETRY','2026-10-02T10:00:00Z'))
 run.retry_of={run_id:'MISSING',artifact:join(varDir,'run-MISSING.json'),run_at:run.started_at,students:1,checks:1}
 writeFileSync(join(varDir,'run-RETRY.json'),JSON.stringify(run))
 expect((await backupRuns(dataDir,examPath)).failures.length).toBeGreaterThan(0)
 expect(listBackups(dataDir,examPath)).toEqual([])
})

/** References deliberately point at an old location: copies use basenames. */
function linkedRun(id: string, previous?: string) {
  const run = parseArtifact(artifact(id, '2026-10-02T10:00:00Z'))
  if (previous) run.retry_of = {
    run_id: previous,
    artifact: `/old/exam/var/run-${previous}.json`,
    run_at: run.started_at,
    students: 1,
    checks: 1
  }
  return run
}

describe('copy chain invariants across writing and recovery', () => {
  const brokenChains = [
    { reason: 'cycle', runs: [linkedRun('HEAD', 'ROOT'), linkedRun('ROOT', 'HEAD')] },
    { reason: 'identity', runs: [linkedRun('HEAD', 'ROOT'), linkedRun('WRONG')] },
    { reason: 'PLAN', runs: [linkedRun('HEAD', 'ROOT'), { ...linkedRun('ROOT'), plan_hash: 'd'.repeat(64) }] },
    { reason: 'missing ancestor', runs: [linkedRun('HEAD', 'ROOT')] }
  ]

  it.each(brokenChains)('rejects $reason before copying or restoring the head', async ({ runs, reason }) => {
    const { dataDir, examPath, varDir } = workspace()
    const slot = slotFor(dataDir, examPath)
    mkdirSync(slot, { recursive: true })
    runs.forEach((run, i) => {
      // In the identity case, the file exists under the expected name but
      // contains a different correction. Each artifact is valid on its own.
      const name = i === 0 ? 'run-HEAD.json' : 'run-ROOT.json'
      writeFileSync(join(varDir, name), JSON.stringify(run))
    })
    const originals = runs.map((_, i) => readFileSync(join(varDir, i === 0 ? 'run-HEAD.json' : 'run-ROOT.json'), 'utf8'))
    const report = await backupRuns(dataDir, examPath)
    expect(report.failures.some(message => message.includes('run-HEAD.json'))).toBe(true)
    expect(listBackups(dataDir, examPath).some(entry => entry.runId === 'HEAD')).toBe(false)
    expect(() => readFileSync(join(slot, 'run-HEAD.json'))).toThrow()

    // Also exercise copies already on disk, without going through copying.
    runs.forEach((run, i) => writeFileSync(join(slot, i === 0 ? 'run-HEAD.json' : 'run-ROOT.json'), JSON.stringify(gradesOnly(run))))
    expect(listBackups(dataDir, examPath).some(entry => entry.runId === 'HEAD')).toBe(false)
    if (reason === 'PLAN') {
      const report = restoreBackups(dataDir, examPath)
      expect(report.problems?.[0]).toContain('run-HEAD.json')
    } else expect(() => restoreBackups(dataDir, examPath)).toThrow()
    originals.forEach((text, i) => expect(readFileSync(join(varDir, i === 0 ? 'run-HEAD.json' : 'run-ROOT.json'), 'utf8')).toBe(text))
    rmSync(varDir, { recursive: true })
    if (reason === 'PLAN') {
      const report = restoreBackups(dataDir, examPath)
      expect(report).toMatchObject({ restored: 1, kept: 0 })
      expect(report.problems?.[0]).toContain('run-HEAD.json')
    } else expect(() => restoreBackups(dataDir, examPath)).toThrow()
    expect(() => readFileSync(join(varDir, 'run-HEAD.json'))).toThrow()
  })

  it.each([49, 50, 51])('enforces the boundary with %i links', async count => {
    const { dataDir, examPath, varDir } = workspace()
    const runs = Array.from({ length: count }, (_, i) => linkedRun(`R${i}`, i ? `R${i - 1}` : undefined))
    runs.forEach(run => writeFileSync(join(varDir, `run-${run.run_id}.json`), JSON.stringify(run)))
    const headId = `R${count - 1}`
    const report = await backupRuns(dataDir, examPath)
    expect(report.failures.some(message => message.includes(`run-${headId}.json`))).toBe(count > 50)
    expect(listBackups(dataDir, examPath).some(entry => entry.runId === headId)).toBe(count <= 50)
    // Seed the same chain for the synchronous path, including the 51st link
    // which the writing path refused to publish.
    const slot = slotFor(dataDir, examPath)
    runs.forEach(run => writeFileSync(join(slot, `run-${run.run_id}.json`), JSON.stringify(gradesOnly(run))))
    expect(listBackups(dataDir, examPath).some(entry => entry.runId === headId)).toBe(count <= 50)
    rmSync(varDir, { recursive: true })
    if (count > 50) {
      const restored = restoreBackups(dataDir, examPath)
      expect(restored).toMatchObject({ restored: 50, kept: 0 })
      expect(restored.problems?.some(problem => problem.includes('run-R50.json') && problem.includes('50'))).toBe(true)
      expect(() => readFileSync(join(varDir, 'run-R50.json'))).toThrow()
      expect(parseArtifact(readFileSync(join(varDir, 'run-R0.json'), 'utf8')).run_id).toBe('R0')
    } else {
      expect(restoreBackups(dataDir, examPath)).toEqual({ restored: count, kept: 0 })
      expect((await backupRuns(dataDir, examPath)).failures).toEqual([])
    }
  })

  it('rejects a corrupt ancestor and preserves its file during rotation', async () => {
    const { dataDir, examPath, varDir } = workspace()
    const slot = slotFor(dataDir, examPath)
    mkdirSync(slot, { recursive: true })
    const root = gradesOnly(linkedRun('ROOT'))
    root.students[0].score.final_score = 0
    const corrupt = JSON.stringify(root)
    writeFileSync(join(slot, 'run-ROOT.json'), corrupt)
    writeFileSync(join(slot, 'run-HEAD.json'), JSON.stringify(gradesOnly(linkedRun('HEAD', 'ROOT'))))
    const listed = listBackups(dataDir, examPath)
    expect(listed.some(entry => !entry.problem)).toBe(false)
    expect(listed.some(entry => entry.problem?.includes('run-ROOT.json'))).toBe(true)
    expect(listed.some(entry => entry.problem?.includes('run-HEAD.json'))).toBe(true)
    expect(() => restoreBackups(dataDir, examPath)).toThrow()
    expect(() => readFileSync(join(varDir, 'run-HEAD.json'))).toThrow()
    const report = await backupRuns(dataDir, examPath)
    expect(report.failures.some(message => message.includes('run-ROOT.json'))).toBe(true)
    expect(report.failures.some(message => message.includes('run-HEAD.json'))).toBe(true)
    expect(readFileSync(join(slot, 'run-ROOT.json'), 'utf8')).toBe(corrupt)
  })

  it('keeps source precedence and falls back to the slot when an ancestor disappears', async () => {
    const { dataDir, examPath, varDir } = workspace()
    const root = linkedRun('ROOT'), head = linkedRun('HEAD', 'ROOT')
    writeFileSync(join(varDir, 'run-ROOT.json'), JSON.stringify(root))
    expect((await backupRuns(dataDir, examPath)).failures).toEqual([])
    writeFileSync(join(varDir, 'run-HEAD.json'), JSON.stringify(head))
    writeFileSync(join(varDir, 'run-ROOT.json'), JSON.stringify({ ...root, plan_hash: 'd'.repeat(64) }))
    // A valid stored copy must not hide an invalid source that still exists.
    expect((await backupRuns(dataDir, examPath)).failures.some(message => message.includes('run-HEAD.json'))).toBe(true)
    rmSync(join(varDir, 'run-ROOT.json'))
    expect((await backupRuns(dataDir, examPath)).failures).toEqual([])
    expect(listBackups(dataDir, examPath).map(entry => entry.runId).sort()).toEqual(['HEAD', 'ROOT'])
    const original = readFileSync(join(varDir, 'run-HEAD.json'), 'utf8')
    expect(restoreBackups(dataDir, examPath)).toEqual({ restored: 1, kept: 1 })
    expect(readFileSync(join(varDir, 'run-HEAD.json'), 'utf8')).toBe(original)
  })

  it('does not infer retries or a session from dates and a shared PLAN', async () => {
    const { dataDir, examPath, varDir } = workspace()
    writeFileSync(join(varDir, 'run-HEAD.json'), JSON.stringify(linkedRun('HEAD', 'MISSING')))
    writeRun(varDir, 'INDEPENDENT', '2026-10-02T09:00:00Z')
    const report = await backupRuns(dataDir, examPath)
    expect(report.saved).toBe(1)
    expect(report.failures.some(message => message.includes('run-HEAD.json'))).toBe(true)
    expect(listBackups(dataDir, examPath).map(entry => entry.runId)).toEqual(['INDEPENDENT'])
    rmSync(varDir, { recursive: true })
    expect(restoreBackups(dataDir, examPath)).toEqual({ restored: 1, kept: 0 })
    const restored = parseArtifact(readFileSync(join(varDir, 'run-INDEPENDENT.json'), 'utf8'))
    expect(restored.retry_of).toBeUndefined()
    expect(restored.students[0].score.final_score).toBe(80)
  })
})
