import {readArtifact} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/artifact';
import {backupRuns} from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/backup';
const root='/tmp/heimdall-repair/large-real';
const path=root+'/var/latest.json';
const run=readArtifact(path);if(!run.students.every(s=>s.score.final_score===100)) throw new Error('changed grades');console.log('accepted');
const report=await backupRuns('/tmp/heimdall-repair/large-data',root+'/examen.yaml');if(report.failures.length) throw new Error(JSON.stringify(report));console.log('real_backup',report);
