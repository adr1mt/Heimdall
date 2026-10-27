// T204: actual renderer/preload/IPC/native validator; temporary fictional data.
import { app, BrowserWindow, dialog } from 'electron'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { registerIpc } from '../src/main/ipc'

const base = mkdtempSync(join(tmpdir(), 'heimdall-ra1-editor-'))
const profile = join(base, 'profile'), project = join(base, 'project')
mkdirSync(profile); mkdirSync(project)
const yaml = readFileSync(resolve('../exams/ra1-dhcp-kea/examen.yaml'), 'utf8')
  .replace('0227 · RA1 · DHCP amb Kea per a 250 equips', 'RA1 ficticio de comprobación')
const examPath = join(project, 'examen.yaml')
writeFileSync(examPath, yaml)
writeFileSync(join(profile, 'settings.json'), JSON.stringify({enginePath:resolve('dist/linux-unpacked/resources/heimdall')}))
app.setPath('userData', profile)
app.disableHardwareAcceleration()
dialog.showOpenDialog = (async () => ({canceled:false,filePaths:[project]})) as never
void app.whenReady().then(async () => {
 let win: BrowserWindow | undefined
 try {
  registerIpc()
  win = new BrowserWindow({show:false, webPreferences:{preload:resolve('out/preload/index.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}})
  const js = async (code:string) => {
   try { return await win!.webContents.executeJavaScript(code) }
   catch(error) { console.error('Renderer expression failed:', code); throw error }
  }
  const wait = async (predicate:string) => {
   for(let n=0;n<150;n++) {if(await js(predicate)) return;await new Promise(r=>setTimeout(r,100))}
   throw Error(await js('document.body.innerText'))
  }
  const click = async (label:string) => js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Unavailable button: '+${JSON.stringify(label)});b.click()})()`)
  await win.loadFile(resolve('out/renderer/index.html'))
  await wait(`!!document.body && [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Abrir…')`)
  await click('Abrir…')
  await wait(`[...document.querySelectorAll('aside button')].some(b=>b.textContent.trim()==='El examen'&&!b.disabled)`)
  await click('El examen')
  await wait(`!!document.querySelector('.monaco-editor textarea')`)
  await click('Validar')
  await wait(`document.querySelector('[role=status]')?.innerText.includes('Examen válido.')`)
  assert.equal(readFileSync(examPath,'utf8'),yaml)
  // The UI correctly disables Guardar for an unchanged file. Exercise the
  // same native save bridge without inventing an edit to the actual exam.
  await js('window.heimdall.writeExam('+JSON.stringify(examPath)+','+JSON.stringify(yaml)+')')
  assert.equal(readFileSync(examPath,'utf8'),yaml)
  assert.equal(await js('window.heimdall.readExam('+JSON.stringify(examPath)+')'),yaml)
  console.log('RA1 GUI OK: real renderer, sandboxed preload, packaged engine; fixed profiles validate and save exactly, without a class. Fictional data only.')
 } catch(err) {console.error(err);process.exitCode=1}
 finally {win?.destroy();app.exit(process.exitCode??0)}
})
