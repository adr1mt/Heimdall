// Drives the shipped application via its local Node inspector. Only the
// native save-file chooser is replaced; IPC, preload, UI, engine and disk are real.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, copyFileSync, writeFileSync, readFileSync, rmSync, openSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
const [binary, kind] = process.argv.slice(2)
if (!binary || !['appimage', 'deb'].includes(kind)) throw Error('Usage: node package-e2e.mjs BINARY appimage|deb')
const root = process.cwd(), work = mkdtempSync(join(tmpdir(), 'heimdall-package-')), profile = join(work, 'profile'), project = join(work, 'exam')
const evidence = join(root, 'docs/releases/0.9.1/evidence')
mkdirSync(profile); mkdirSync(project)
copyFileSync(join(root, 'testdata/proto/examen.yaml'), join(project, 'examen.yaml'))
writeFileSync(join(profile, 'projects.json'), JSON.stringify({ recent: [{ dir: project, name: 'Prueba de paquete' }] }))
writeFileSync(join(profile, 'classes.json'), JSON.stringify({ classes: [{ id: 'lab', name: 'Laboratorio', columns: [], students: [
 { id: 'alumne01', name: 'Alumna Uno', host: '127.1.2.3', port: '2201', user: 'alumno', contact: '', fields: {} },
 { id: 'alumne02', name: 'Alumne Dos', host: '127.1.2.3', port: '2299', user: 'alumno', contact: '', fields: {} }
] }] }))
const port = kind === 'appimage' ? 9237 : 9238
const log = openSync(join(work, 'application.log'), 'w')
const child = spawn(resolve(binary), [...(kind === 'appimage' ? ['--appimage-extract-and-run'] : []), '--no-sandbox', `--user-data-dir=${profile}`, `--inspect=127.0.0.1:${port}`], { stdio: ['ignore', log, log], detached: true })
const exited = new Promise(r => child.on('exit', r))
const wait = ms => new Promise(r => setTimeout(r, ms))
let ws
try {
 let endpoint
 for (let i=0; i<150; i++) {
  try { endpoint = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())[0]; if(endpoint)break } catch {}
  if(child.exitCode !== null) throw Error('Application exited before inspector became available')
  await wait(200)
 }
 if(!endpoint) throw Error('No inspector')
 ws = new WebSocket(endpoint.webSocketDebuggerUrl)
 await new Promise(r=>ws.addEventListener('open',r,{once:true}))
 let id=0; const pending=new Map()
 ws.addEventListener('message', e=>{const m=JSON.parse(e.data); if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}})
 const ev = async expression => {
  const n=++id; const p=new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Inspector timed out')),20000);pending.set(n,m=>{clearTimeout(timer);r(m)})})
  ws.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))
  const m=await p; if(m.error||m.result?.exceptionDetails)throw Error(JSON.stringify(m)); return m.result.result.value
 }
 const electron = "process.mainModule.require('electron')"
 const js = code=>ev(`${electron}.BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(${JSON.stringify(code)})`)
 const until = async (fn, label, timeout=30000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await wait(250)}throw Error('Timed out: '+label)}
 const check=(value,label)=>{if(!value)throw Error(label);console.log('OK '+kind+' '+label)}
 const click=async (text,scope='body',includes=false)=>{
  check(await js(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(b=>${includes?'b.textContent.trim().includes('+JSON.stringify(text)+')':'b.textContent.trim()==='+JSON.stringify(text)});if(b&&!b.disabled){b.click();return true}return false})()`),'botón '+text)
  await wait(350)
 }
 await until(()=>ev('!!process.mainModule'),'main process initialized')
 await ev(`${electron}.app.whenReady().then(()=>true)`)
 await until(()=>js('!!window.heimdall && !!document.querySelector("main")'),'preload and UI')
 check(await ev(`${electron}.app.getVersion()`) === '0.9.1','GUI 0.9.1')
 const engine=await js('window.heimdall.detectEngine()')
 check(engine.found && engine.version==='0.9.1','motor embebido 0.9.1 '+engine.path)
 check((await ev(`${electron}.BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()`)).sandbox,'renderer sandbox activo')
 await click('Prueba de paquete','main',true)
 await click('Corregir','aside')
 await js(`(()=>{const s=document.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'lab');s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
 await wait(500)
 await js(`(()=>{const e=document.querySelector('input[type=password]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'HEIMDALL_SECRET_TEST_12345');e.dispatchEvent(new Event('input',{bubbles:true}));window.__closed=null;window.heimdall.onRunClosed(c=>window.__closed=c)})()`)
 await wait(400); await click('Corregir','main')
 await until(()=>js('!!window.__closed'),'SSH correction')
 await until(()=>js('document.querySelector("main").innerText.includes("de peso total")'),'results')
 const result=await js('document.querySelector("main").innerText')
 check(result.includes('Alumna Uno') && result.includes('Alumne Dos'),'ambos alumnos aparecen en resultados')
 await until(()=>js(`window.heimdall.listBackups(${JSON.stringify(join(project,'examen.yaml'))}).then(b=>b.length>0)`),'automatic backup')
 const runs=await js(`window.heimdall.listRuns(${JSON.stringify(join(project,'examen.yaml'))})`)
 check(runs.length===1,'corrección guardada')
 const artifact=JSON.parse(readFileSync(join(project,'var/latest.json'),'utf8'))
 const summaries=artifact.students.map(s=>({id:s.student_id,status:s.status,score:s.score.final_score}))
 console.log('NOTAS '+JSON.stringify(summaries))
 check(artifact.students.find(s=>s.student_id==='alumne02').score.final_score===null,'máquina apagada conserva ausencia de nota')
 await click('Histórico','aside'); await click('Abrir','main')
 check(await js('document.querySelector("main").innerText')===result,'histórico conserva exactamente los resultados')
 await ev(`${electron}.dialog.showSaveDialog=async()=>({canceled:false,filePath:${JSON.stringify(join(work,'grades.csv'))}});true`)
 await click('Exportar notas','main',true); await click('Guardar el fichero')
 await until(async()=>{try{return readFileSync(join(work,'grades.csv'),'utf8').replace(/^\uFEFF/, '').startsWith('alumno;identificador;moodle')}catch{return false}},'export CSV')
 check(!readFileSync(join(work,'grades.csv'),'utf8').includes('HEIMDALL_SECRET_TEST_12345'),'CSV sin contraseña')
 rmSync(join(project,'var'),{recursive:true,force:true})
 await click('Histórico','aside'); await click('Actualizar','main'); await click('Restaurar las notas','main',true)
 await wait(500); await click('Abrir','main')
 await until(()=>js('document.querySelector("main").innerText.includes("de peso total")'),'restored results')
 const recovered=await js('document.querySelector("main").innerText')
 writeFileSync(join(evidence,kind+'-before.txt'),result)
 writeFileSync(join(evidence,kind+'-restored.txt'),recovered)
 const restoredRuns=await js(`window.heimdall.listRuns(${JSON.stringify(join(project,'examen.yaml'))})`)
 const restored=JSON.parse(readFileSync(restoredRuns[0].path,'utf8'))
 check(JSON.stringify(restored.students.map(s=>({id:s.student_id,status:s.status,score:s.score})))===JSON.stringify(artifact.students.map(s=>({id:s.student_id,status:s.status,score:s.score}))),'restauración conserva exactamente estados y notas')
 check(recovered.includes('Alumna Uno')&&recovered.includes('Alumne Dos'),'resultados restaurados visibles')
 await click('Matriz','main'); await click('Modo proyector','aside')
 check(await js('document.querySelectorAll("aside").length')===0,'proyector oculta menú del profesor')
 check(!await js('document.body.innerText.includes("127.1.2.3")'),'proyector oculta direcciones')
 await js("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");await wait(350)
 for(const name of ['Analíticas','Clases','El examen','Ajustes','Ayuda']) {
  await click(name,'aside');check(!await js('document.body.innerText.includes("Esta vista no se pudo mostrar")'),'vista '+name+' funcional')
 }
 await click('Resultados','aside')
 await ev(`${electron}.BrowserWindow.getAllWindows()[0].webContents.capturePage().then(p=>process.mainModule.require('fs').writeFileSync(${JSON.stringify(join(evidence,kind+'-results.png'))},p.toPNG()))`)
 console.log('PERFIL '+work)
 await ev(`${electron}.app.quit()`);ws.close();ws=null
 await Promise.race([exited,wait(10000).then(()=>{throw Error('Application failed to close')})])
 check(child.exitCode===0,'cierre normal')
} finally {ws?.close();if(child.exitCode===null){try{process.kill(-child.pid,'SIGTERM')}catch{}}}
