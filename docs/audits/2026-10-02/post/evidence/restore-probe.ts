import {rmSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {restoreBackups} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/backup';
const root='/tmp/heimdall-post-audit';
rmSync(root+'/history/var',{recursive:true});
console.log('restored',restoreBackups(root+'/data',root+'/history/examen.yaml'));
const result=spawnSync('/tmp/heimdall-audit-engine',['consolidate',root+'/history/var/run-R50.json'],{encoding:'utf8'});
console.log('consolidate_restored',{exit:result.status,problem:result.stderr.trim()});
for(const name of ['zero','longvalue']) {
 const path=root+'/'+name+'/var/latest.json';
 const result=spawnSync('/tmp/heimdall-audit-engine',['session',path],{encoding:'utf8'});
 console.log(name,'cli_reader',{exit:result.status,problem:result.stderr.trim()});
}
