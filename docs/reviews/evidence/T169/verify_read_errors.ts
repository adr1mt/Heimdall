// Run against a valid generated result as an unprivileged user.
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { backupRuns, listBackups, restoreBackups, slotFor } from '../../../../gui/src/main/backup'
import { listRuns } from '../../../../gui/src/main/history'
import { parseArtifact } from '../../../../gui/src/shared/artifact'

async function main(): Promise<void> {
  const source = process.argv[2]
  if (!source) throw new Error('Falta la ruta de un resultado válido.')
  const work = mkdtempSync('/tmp/heimdall-t169-')
  const exam = join(work, 'exam', 'examen.yaml')
  const runs = join(work, 'exam', 'var')
  const data = join(work, 'data')
  mkdirSync(runs, { recursive: true })
  try {
    const fixture = parseArtifact(readFileSync(source, 'utf8'))
    for (const id of ['GOOD', 'BAD']) {
      fixture.run_id = id
      writeFileSync(join(runs, `run-${id}.json`), JSON.stringify(fixture))
    }
    assert.deepEqual(await backupRuns(data, exam), { saved: 2, failures: [] })
    const slot = slotFor(data, exam)

    chmodSync(runs, 0o000)
    try {
      await assert.rejects(listRuns(runs), error => String(error).includes(runs) && String(error).includes('EACCES'))
      console.log('history directory: path and EACCES reported')
    } finally { chmodSync(runs, 0o700) }

    chmodSync(slot, 0o000)
    try {
      assert.throws(() => listBackups(data, exam), error => String(error).includes(slot) && String(error).includes('EACCES'))
      assert.throws(() => restoreBackups(data, exam), error => String(error).includes(slot) && String(error).includes('EACCES'))
      console.log('backup directory: path and EACCES reported')
    } finally { chmodSync(slot, 0o700) }

    const badCopy = join(slot, 'run-BAD.json')
    writeFileSync(badCopy, '{broken')
    const listed = listBackups(data, exam)
    assert.equal(listed.filter(row => !row.problem).length, 1)
    assert.equal(listed.filter(row => row.problem?.includes(badCopy)).length, 1)
    rmSync(join(runs, 'run-GOOD.json'))
    const report = restoreBackups(data, exam)
    assert.equal(report.restored, 1)
    assert.equal(report.problems?.length, 1)
    assert.equal(readFileSync(join(runs, 'run-GOOD.json'), 'utf8'), readFileSync(join(slot, 'run-GOOD.json'), 'utf8'))
    assert.equal(readFileSync(badCopy, 'utf8'), '{broken')
    console.log('mixed copies: valid grades restored, corrupt file reported and preserved')

    rmSync(join(slot, 'run-GOOD.json'))
    assert.throws(() => restoreBackups(data, exam), /run-BAD\.json/)
    console.log('only corrupt copy: restore names the file instead of claiming absence')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1 })
