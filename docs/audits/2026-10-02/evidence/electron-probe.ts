import { app, BrowserWindow, safeStorage } from 'electron'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpc } from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/ipc'
import { rememberPassword } from '/mnt/datos/Applications/Claude/Heimdall/gui/src/main/vault'

const repo = '/mnt/datos/Applications/Claude/Heimdall'
const root = mkdtempSync('/tmp/heimdall-audit-electron-')
const data = join(root, 'data')
const project = join(root, 'project')
mkdirSync(data)
mkdirSync(project)
app.setPath('userData', data)
app.disableHardwareAcceleration()
writeFileSync(join(data, 'settings.json'), JSON.stringify({ enginePath: '/tmp/heimdall-audit/heimdall' }))
writeFileSync(join(data, 'classes.json'), JSON.stringify({classes:[{id:'audit',name:'Clase de auditoría',columns:[],students:[{id:'audit',name:'Persona ficticia',contact:'',host:'127.1.2.3',port:'2201',user:'alumno',fields:{}}]}]}))
writeFileSync(join(project, 'examen.yaml'), 'examen: "Auditoría ficticia"\nversion: 1\nhosts: [host1]\ngrupos:\n  - grupo: "Audit"\n    comprobaciones:\n      - id: "audit"\n        descripcion: "Audit"\n        en: host1\n        cmd: ["true"]\n        exit_code: 0\n')
writeFileSync(join(data, 'projects.json'), JSON.stringify({recent:[{dir:project,name:'Auditoría ficticia'}]}))

app.whenReady().then(async () => {
 console.log('storage:', JSON.stringify({available:safeStorage.isEncryptionAvailable(),backend:safeStorage.getSelectedStorageBackend(),stored:rememberPassword(data,{available:()=>safeStorage.isEncryptionAvailable(),encrypt:p=>safeStorage.encryptString(p),decrypt:p=>safeStorage.decryptString(p)},'AUDIT_FAKE_PASSWORD')}))
 registerIpc()
 const win = new BrowserWindow({width:1280,height:820,show:true,webPreferences:{preload:join(repo,'gui/out/preload/index.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}})
 win.webContents.on('console-message',(_e,_level,message)=>console.log('renderer:',message))
 await win.loadFile(join(repo,'gui/out/renderer/index.html'))
 await win.webContents.executeJavaScript("localStorage.setItem('heimdall-class-id','audit')")
 await win.webContents.reload()
 await new Promise(r=>setTimeout(r,700))
 const click = async (label:string) => {
  const matched = await win.webContents.executeJavaScript(`(() => {const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(label)})); if(!b) return false; b.click();return true})()`)
  console.log('clicked:',label,matched)
  await new Promise(r=>setTimeout(r,500))
 }
 await click('Auditoría ficticia')
 await click('El examen')
 console.log('editor:',await win.webContents.executeJavaScript('document.body.innerText.slice(-1600)'))
 await click('YAML')
 await win.webContents.executeJavaScript(`(() => {const t=document.querySelector('textarea'); if (!t) return false; const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(t,t.value+'\\nfoo: [');t.dispatchEvent(new Event('input',{bubbles:true})); return true})()`)
 await new Promise(r=>setTimeout(r,200))
 console.log('invalid YAML save:',await win.webContents.executeJavaScript(`(() => {const save=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Guardar'));return {saveDisabled:save?.disabled,parseError:document.body.innerText.includes('YAML'),textarea:document.querySelector('textarea')?.value.slice(-15)}})()`))
 await click('Guardar')
 console.log('after save:',await win.webContents.executeJavaScript('document.body.innerText.slice(-500)'))
 console.log('invalid draft written:',readFileSync(join(project,'examen.yaml'),'utf8').includes('foo: ['))
 await new Promise(r=>setTimeout(r,300))
 console.log('dark DOM:',await win.webContents.executeJavaScript("({classes:document.documentElement.className,background:getComputedStyle(document.body).backgroundColor})"))
 writeFileSync('/tmp/heimdall-audit/editor-dark.png',(await win.webContents.capturePage()).toPNG())
 await win.webContents.executeJavaScript("document.documentElement.classList.remove('dark')")
 await new Promise(r=>setTimeout(r,300))
 writeFileSync('/tmp/heimdall-audit/editor-light.png',(await win.webContents.capturePage()).toPNG())
 win.setSize(960,640)
 await new Promise(r=>setTimeout(r,200))
 writeFileSync('/tmp/heimdall-audit/editor-small.png',(await win.webContents.capturePage()).toPNG())
 console.log('output directory:',root)
 win.destroy()
 app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
