import {readFileSync,writeFileSync,mkdirSync,utimesSync} from 'node:fs';
import {join} from 'node:path';
import {parseArtifact} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/shared/artifact';
import {validRun} from '/mnt/datos/Applications/Claude/Heimdall/gui/tests/fixtures/valid-run';
import {backupRuns,restoreBackups,slotFor} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/backup';
import {listRuns} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/history';
import {downloadUpdate} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/update-download';
import {Updater} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/updater';
import {readArtifact} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/artifact';
const root='/tmp/heimdall-post-audit';
for(const name of ['zero','longvalue']) {
 const path=join(root,name,'var/latest.json');
 try{parseArtifact(readFileSync(path,'utf8'));console.log(name,'ACCEPTED')}catch(e){console.log(name,String(e))}
}
const exam=join(root,'history/examen.yaml'),dir=join(root,'history/var'),data=join(root,'data');mkdirSync(dir,{recursive:true});
for(let i=0;i<51;i++) {
 const run=validRun();run.run_id='R'+i;
 run.started_at=run.finished_at=new Date(Date.UTC(2026,0,1,0,0,i)).toISOString();
 if(i===50) run.retry_of={run_id:'R0',artifact:join(dir,'run-R0.json'),run_at:run.started_at,students:1,checks:1};
 const path=join(dir,`run-R${i}.json`);writeFileSync(path,JSON.stringify(run));
 const reverse=new Date(Date.UTC(2026,0,1,0,0,51-i));utimesSync(path,reverse,reverse);
}
const history=await listRuns(dir);console.log('history',{count:history.length,newestShown:history[0]?.runId,includesNewest:history.some(r=>r.runId==='R50')});
console.log('backup',await backupRuns(data,exam));console.log('backup_oldest_exists',await import('node:fs').then(fs=>fs.existsSync(join(slotFor(data,exam),'run-R0.json'))));
const target=join(root,'working.AppImage');writeFileSync(target,'previous-working-binary');
globalThis.fetch=async()=>new Response('',{status:200,headers:{'content-length':'0'}});
const updater=new Updater({currentVersion:'0.9.0',appImagePath:target,downloadDir:join(root,'updates'),busy:()=>false,
 fetchText:async()=>JSON.stringify({tag_name:'v1.0.0',assets:[{browser_download_url:'https://github.com/adr1mt/Heimdall/releases/download/v1.0.0/Heimdall.AppImage'}]}),
 download:downloadUpdate,announce:()=>{},log:console.log});
console.log('empty_update',{check:await updater.check(),applied:updater.applyOnQuit(),bytes:readFileSync(target).length});
// Legitimate inventory command produces 1024 control bytes per student/check;
// JSON escapes expand them while the raw stream remains far under 64 KiB.
const large=validRun();large.plan={...large.plan,check_count:20,total_weight:20,check_ids:Array.from({length:20},(_,i)=>'c'+i)};
const check=large.students[0].checks[0];check.execution!.stdout={text:'\x01'.repeat(20000),bytes:20000,bytes_total:20000,truncated:false};
check.assertion={kind:'exit_code',expected:'0',found:'0',matched:true};
large.students=Array.from({length:30},(_,i)=>({...structuredClone(large.students[0]),student_id:'s'+i,score:{...large.students[0].score,obtained:20,evaluable:20,total:20},checks:large.plan.check_ids.map(id=>({...structuredClone(check),check_id:id}))}));
const text=JSON.stringify(large),path=join(root,'large.json');writeFileSync(path,text);
try{parseArtifact(text);console.log('large_schema_accepted',true)}catch(e){console.log('large_schema_accepted',String(e))}
try{readArtifact(path);console.log('large_file_accepted',true)}catch(e){console.log('large_file',{bytes:Buffer.byteLength(text),problem:String(e)})}
