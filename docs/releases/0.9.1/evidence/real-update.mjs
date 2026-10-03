// Real AppImage, real GitHub feed/network and actual normal-quit replacement.
// Never injects metadata, download bytes, credentials or updater dependencies.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { openSync, readFileSync, copyFileSync, chmodSync } from 'node:fs'
import { resolve, join } from 'node:path'
const target=resolve(process.argv[2]||'/tmp/heimdall-release-0.9.1/Heimdall.AppImage')
const work=resolve('/tmp/heimdall-release-0.9.1'), profile=join(work,'real-update-profile')
if(!target.startsWith(work+'/'))throw Error('Only a disposable AppImage copy may be replaced')
const feed='https://api.github.com/repos/adr1mt/Heimdall/releases/latest'
const newFile=resolve('gui/dist/Heimdall-0.9.1.AppImage')
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex')
const initial=sha(target), expected=sha(newFile), wait=ms=>new Promise(r=>setTimeout(r,ms))
const feedResponse=await fetch(feed,{headers:{accept:'application/vnd.github+json'}})
const feedStatus=feedResponse.status
console.log('FEED sin autenticación HTTP '+feedStatus)
async function launch(label){
 const logPath=join(work,label+'.log'),log=openSync(logPath,'w')
 const child=spawn(target,['--appimage-extract-and-run','--no-sandbox',`--user-data-dir=${profile}`,'--inspect=127.0.0.1:9239'],{stdio:['ignore',log,log],detached:true})
 const exited=new Promise(r=>child.on('exit',r));let ws
 try{
  let endpoint
  for(let i=0;i<150;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9239/json/list')).json())[0];if(endpoint)break}catch{}if(child.exitCode!==null)throw Error('AppImage exited');await wait(200)}
  if(!endpoint)throw Error('No inspector')
  ws=new WebSocket(endpoint.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}))
  let id=0;const pending=new Map()
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}})
  const ev=async expression=>{const n=++id;const p=new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Inspector timed out')),20000);pending.set(n,m=>{clearTimeout(timer);r(m)})});ws.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));const m=await p;if(m.error||m.result?.exceptionDetails)throw Error(JSON.stringify(m));return m.result.result.value}
  const until=async(fn,timeout=30000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await wait(250)}throw Error('Timed out waiting for application')}
  const electron="process.mainModule.require('electron')"
  const js=code=>ev(`${electron}.BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(${JSON.stringify(code)})`)
  await until(()=>ev('!!process.mainModule'))
  await ev(`${electron}.app.whenReady().then(()=>true)`)
  await until(()=>js('!!window.heimdall&&!!document.querySelector("main")'))
  return {child,logPath,ev,js,version:await ev(`${electron}.app.getVersion()`),close:async()=>{await ev(`${electron}.app.quit()`);ws.close();await Promise.race([exited,wait(10000).then(()=>{throw Error('Normal quit failed')})]);if(child.exitCode!==0)throw Error('Quit code '+child.exitCode)},kill:()=>{ws?.close();if(child.exitCode===null){try{process.kill(-child.pid,'SIGTERM')}catch{}}}}
 }catch(e){ws?.close();if(child.exitCode===null){try{process.kill(-child.pid,'SIGTERM')}catch{}}throw e}
}
let running=await launch('old-appimage')
try{
 console.log('VERSION ANTERIOR '+running.version)
 if(running.version!=='0.9.0')throw Error('Expected genuine old 0.9.0 package')
 await running.js("window.heimdall.saveClasses([{id:'update-fixture',name:'Clase de prueba de actualización',columns:[],students:[]}])")
 await running.js("window.__releaseReady=null;window.heimdall.onUpdateReady(v=>window.__releaseReady=v);true")
 let ready=null, blocked=false
 const deadline=Date.now()+210000
 while(Date.now()<deadline){
  ready=await running.js('window.__releaseReady')
  if(ready)break
  if(feedStatus===404&&readFileSync(running.logPath,'utf8').includes('actualización: no se pudo comprobar')){blocked=true;break}
  await wait(1000)
 }
 if(sha(target)!==initial)throw Error('AppImage changed while window was open')
 console.log('OK programa anterior conservado mientras está abierto '+initial)
 if(blocked){
  const messages=readFileSync(running.logPath,'utf8').split('\n').filter(l=>l.includes('actualización:'))
  messages.forEach(l=>console.log(l))
  await running.close()
  if(sha(target)!==initial)throw Error('Failed update changed installed copy')
  console.log('BLOQUEADA_PRIVACIDAD: la aplicación anterior no puede acceder a la release privada; copia intacta después del cierre')
  const manualSource=process.argv[3]
  if(manualSource){
   if(sha(manualSource)!==expected)throw Error('Manual release download differs from verified package')
   copyFileSync(manualSource,target)
   chmodSync(target,0o755)
   running=await launch('manually-updated-appimage')
   const engine=await running.js('window.heimdall.detectEngine()')
   const classes=await running.js('window.heimdall.listClasses()')
   if(running.version!=='0.9.1'||engine.version!=='0.9.1'||!engine.found)throw Error('Manual upgrade versions mismatch')
   if(!classes.some(c=>c.id==='update-fixture'))throw Error('Saved class lost after manual upgrade')
   console.log('OK ACTUALIZACION MANUAL REAL desde descarga privada de GitHub: GUI y motor 0.9.1; clase guardada conservada; SHA256 '+sha(target))
   await running.close()
  }
  process.exitCode=3
 }else{
  if(ready!=='0.9.1')throw Error('Update not announced: '+ready)
  console.log('OK versión descargada '+ready)
  await running.close()
  if(sha(target)!==expected)throw Error('Installed AppImage differs from released binary')
  console.log('OK sustitución al cerrar SHA256 '+expected)
  running=await launch('updated-appimage')
  const engine=await running.js('window.heimdall.detectEngine()')
  if(running.version!=='0.9.1'||engine.version!=='0.9.1'||!engine.found)throw Error('Updated versions mismatch')
  console.log('OK reapertura GUI y motor 0.9.1')
  await running.close()
 }
}finally{running.kill()}
