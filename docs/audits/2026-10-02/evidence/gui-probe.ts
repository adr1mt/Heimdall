import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupRuns, slotFor } from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/backup'
import { readClasses, writeClasses, classesFile } from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/classes'
import { readExam, examYaml } from '/mnt/datos/Applications/Claude/Heimdall/gui/src/shared/exam'
import { parseArtifact } from '/mnt/datos/Applications/Claude/Heimdall/gui/src/shared/artifact'
import { RunSession } from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/run'
import { Updater } from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/updater'

const root = mkdtempSync(join(tmpdir(), 'heimdall-audit-node-'))
const project = join(root, 'project')
const data = join(root, 'data')
const varDir = join(project, 'var')
mkdirSync(varDir, { recursive: true })
const fixture = JSON.parse(readFileSync('/mnt/datos/Applications/Claude/Heimdall/internal/model/testdata/run-example.json', 'utf8'))
for (let i = 1; i <= 100; i++) {
 const id = String(i).padStart(3, '0')
 writeFileSync(join(varDir, `run-audit-${id}.json`), JSON.stringify({ ...fixture, run_id: `audit-${id}` }))
}
const path = join(project, 'examen.yaml')
console.log('backup first:', backupRuns(data, path))
const slot = slotFor(data, path)
const first = readdirSync(slot).sort()
console.log('backup first retained:', first.length, first[0], first.at(-1))
for (const name of first) utimesSync(join(slot, name), new Date(100000), new Date(100000))
console.log('backup second:', backupRuns(data, path))
const second = readdirSync(slot).sort()
console.log('backup second retained:', second.length, second[0], second.at(-1))

const yaml = 'examen: "Audit"\nversion: 1\ngrupos:\n  - grupo: "Audit"\n    comprobaciones:\n      - id: "audit"\n        descripcion: "Audit"\n        valor: "ok"\n        peso: 0.5\n        contiene: "ok"\n'
const read = readExam(yaml)
if ('exam' in read) {
 const written = examYaml(read.exam)
 console.log('decimal weight written:', written.split('\n').find(line => line.includes('peso:')))
 mkdirSync(join(root, 'decimal'))
 writeFileSync(join(root, 'decimal', 'examen.yaml'), written)
 writeFileSync(join(root, 'decimal', 'aula.yaml'), 'aula: "Audit"\nversion: 1\nalumnos:\n  - id: "alu1"\n    nombre: "Audit"\n')
}
const ambiguous = readExam(yaml.replace('        contiene: "ok"', '        contiene: "ok"\n        no_contiene: "bad"\n        clave_desconocida: "secret"'))
if ('exam' in ambiguous) console.log('unknown and extra assertion silently dropped:', !examYaml(ambiguous.exam).includes('no_contiene'), !examYaml(ambiguous.exam).includes('clave_desconocida'))

writeFileSync(classesFile(data), JSON.stringify({classes: [{id: 'valid', name: 'Valid', students: [{id: 'alu1', name: 'Audit'}]}, {id: 'broken', students: [{id: 'alu2', name: 'Audit2'}]}]}))
const groups = readClasses(data)
writeClasses(data, groups)
console.log('class corruption: disk had 2 classes, read returned', groups.length, 'and save wrote', JSON.parse(readFileSync(classesFile(data), 'utf8')).classes.length)

const broken = { ...fixture, students: [{ ...fixture.students[0], checks: null, score: { ...fixture.students[0].score, status: 'COMPLETE', final_score: 100 }}] }
console.log('artifact with missing checks accepted:', parseArtifact(JSON.stringify(broken)).students[0].score.final_score)

let closes = 0
await new Promise<void>((resolve) => {
 new RunSession('/tmp/heimdall-audit-no-such-engine', {dir: project, className: 'aula.yaml'}, {}, {
  onEvent: () => {},
  onClose: () => { closes++; setTimeout(resolve, 50) }
 })
})
console.log('missing engine close notifications:', closes)
let correcting = false
let downloadedWhileBusy = false
const updater = new Updater({currentVersion:'0.9.0',appImagePath:join(root,'app.AppImage'),downloadDir:join(root,'updates'),busy:()=>correcting,
 fetchText:async()=>{correcting=true;return JSON.stringify({tag_name:'v1.0.0',assets:[{browser_download_url:'https://github.com/adr1mt/Heimdall/releases/download/v1.0.0/Heimdall-1.0.0.AppImage'}]})},
 download:async(_url,dest)=>{downloadedWhileBusy=correcting;writeFileSync(dest,'FAKE UPDATE')},announce:()=>{},log:()=>{}})
console.log('updater outcome:',await updater.check(),'download began during correction:',downloadedWhileBusy)
console.log('probe directory:', root)
