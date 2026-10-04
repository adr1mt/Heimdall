// Run with a generated n30-s65536 artifact and --max-old-space-size=128.
// Exercises the production copy and recovery paths with 50 large originals.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { backupRuns, restoreBackups, slotFor } from '../../../../gui/src/main/backup'
import { parseArtifact } from '../../../../gui/src/shared/artifact'
import { gradesOnly } from '../../../../gui/src/shared/backup'

async function main(): Promise<void> {
  const source = process.argv[2]
  if (!source) throw new Error('Falta la ruta de un resultado n30-s65536.')
  const work = mkdtempSync('/tmp/heimdall-t168-')
  const exam = join(work, 'exam', 'examen.yaml')
  const runs = join(work, 'exam', 'var')
  const data = join(work, 'data')
  mkdirSync(runs, { recursive: true })
  const fixture = parseArtifact(readFileSync(source, 'utf8'))
  for (let i = 0; i < 50; i++) {
    fixture.run_id = `SYNTHETIC${i}`
    writeFileSync(join(runs, `run-SYNTHETIC${i}.json`), JSON.stringify(fixture))
  }

  for (let pass = 1; pass <= 2; pass++) {
    global.gc?.()
    const report = await backupRuns(data, exam)
    assert.deepEqual(report, { saved: pass === 1 ? 50 : 0, failures: [] })
    console.log(JSON.stringify({ pass, ...report, heapUsed: process.memoryUsage().heapUsed }))
  }

  const slot = slotFor(data, exam)
  assert.equal(readdirSync(slot).length, 50)
  for (let i = 0; i < 50; i++) {
    const name = `run-SYNTHETIC${i}.json`
    const original = parseArtifact(readFileSync(join(runs, name), 'utf8'))
    const copy = parseArtifact(readFileSync(join(slot, name), 'utf8'))
    assert.deepEqual(copy, gradesOnly(original))
  }
  rmSync(runs, { recursive: true })
  assert.deepEqual(restoreBackups(data, exam), { restored: 50, kept: 0 })
  for (let i = 0; i < 50; i++) {
    const name = `run-SYNTHETIC${i}.json`
    assert.equal(readFileSync(join(runs, name), 'utf8'), readFileSync(join(slot, name), 'utf8'))
  }
  console.log(JSON.stringify({ copies: 50, comparedWithOriginals: 50, restored: 50, work }))
}

void main().catch(error => { console.error(error); process.exitCode = 1 })
