// Synthetic audit: imports the production readers and backup writer.
import { copyFileSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { backupRuns, listBackups, slotFor, restoreBackups } from '../../../../gui/src/main/backup'
import { listRuns } from '../../../../gui/src/main/history'
import { parseArtifact } from '../../../../gui/src/shared/artifact'

async function main(): Promise<void> {
  const [source, countText = '50'] = process.argv.slice(2)
  const count = Number(countText)
  const work = mkdtempSync('/tmp/heimdall-audit-backup-')
  const exam = join(work, 'exam', 'examen.yaml'), data = join(work, 'data'), runs = join(work, 'exam', 'var')
  mkdirSync(runs, { recursive: true })
  const fixture = parseArtifact(readFileSync(source, 'utf8'))
  for (let i = 0; i < count; i++) {
    fixture.run_id = `SYNTHETIC${i}`
    writeFileSync(join(runs, `run-SYNTHETIC${i}.json`), JSON.stringify(fixture))
  }
  for (let i = 0; i < 2; i++) {
    global.gc?.()
    const before = process.memoryUsage(), start = performance.now()
    const result = await backupRuns(data, exam)
    console.log(JSON.stringify({case:'backup',pass:i+1,count,sourceBytes:readFileSync(source).length,seconds:(performance.now()-start)/1000,before,after:process.memoryUsage(),maxRssKiB:process.resourceUsage().maxRSS,...result}))
  }
  chmodSync(runs, 0o000)
  try { console.log(JSON.stringify({case:'unreadable-history',rows:await listRuns(runs)})) }
  finally { chmodSync(runs,0o700) }
  const slot = slotFor(data, exam)
  chmodSync(slot, 0o000)
  try { console.log(JSON.stringify({case:'unreadable-backups',rows:listBackups(data,exam)})) }
  finally { chmodSync(slot,0o700) }
  const singleWork = mkdtempSync('/tmp/heimdall-audit-corrupt-'), singleExam = join(singleWork,'examen.yaml')
  const singleSlot = slotFor(data,singleExam)
  mkdirSync(singleSlot,{recursive:true})
  copyFileSync(join(slot,'run-SYNTHETIC0.json'),join(singleSlot,'run-SYNTHETIC0.json'))
  writeFileSync(join(singleSlot,'run-SYNTHETIC0.json'),'{broken')
  let restoration = ''
  try { restoreBackups(data,singleExam) } catch(error) { restoration=String(error) }
  console.log(JSON.stringify({case:'corrupt-backup',listed:listBackups(data,singleExam),restoration}))
  console.log(JSON.stringify({temporary_work:work,temporary_corrupt:singleWork}))
}
void main().catch(error => {console.error(error);process.exitCode=1})
