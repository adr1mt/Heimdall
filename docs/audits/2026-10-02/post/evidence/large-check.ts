import {readArtifact} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/artifact';
import {backupRuns} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/backup';
import {readdirSync} from 'node:fs';
const root='/tmp/heimdall-post-audit/large-real';
const path=root+'/var/'+readdirSync(root+'/var').find(n=>/^run-.*\.json$/.test(n));
try{readArtifact(path);console.log('accepted')}catch(e){console.log('real_GUI_reader',String(e))}
console.log('real_backup',await backupRuns('/tmp/heimdall-post-audit/large-data',root+'/examen.yaml'));
