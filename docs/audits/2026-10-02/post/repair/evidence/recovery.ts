import { mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { validRun } from '../../../../../../gui/tests/fixtures/valid-run'
import { backupRuns, listBackups, restoreBackups } from '../../../../../../gui/src/main/backup'
import { listRuns } from '../../../../../../gui/src/main/history'
const root='/tmp/heimdall-repair/recovery',data=join(root,'profile'),exam=join(root,'project/examen.yaml'),dir=join(root,'project/var')
rmSync(root,{recursive:true,force:true});mkdirSync(dir,{recursive:true});writeFileSync(exam,'examen: Ficticio\n')
for(let i=0;i<51;i++) {
 const run=validRun();run.run_id=`R${i}`;run.started_at=run.finished_at=new Date(Date.UTC(2026,9,2,0,i)).toISOString()
 if(i===50) run.retry_of={run_id:'R0',artifact:join(dir,'run-R0.json'),run_at:run.started_at,students:1,checks:1}
 const path=join(dir,`run-R${i}.json`);writeFileSync(path,JSON.stringify(run));utimesSync(path,51-i,51-i)
}
assert.equal((await listRuns(dir))[0].runId,'R50')
for(let i=0;i<3;i++) assert.deepEqual((await backupRuns(data,exam)).failures,[])
assert.equal(listBackups(data,exam).length,51)
rmSync(dir,{recursive:true});console.log('restore',restoreBackups(data,exam))
const result=spawnSync('/mnt/datos/Applications/Claude/Heimdall/bin/heimdall',['consolidate',join(dir,'run-R50.json')],{encoding:'utf8'})
assert.equal(result.status,0,result.stderr)
assert.equal(JSON.parse(result.stdout).students[0].score.final_score,100)
console.log('history_latest','R50','complete_chain_restored',true,'consolidation_exit',result.status)
