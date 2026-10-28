// Full main/preload/renderer reopen proof with a synthetic finalized session.
import { app, BrowserWindow } from 'electron'
import assert from 'node:assert/strict'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { root, engine, group, final } from './exam-session-lab'
import { ExamRecords } from '../src/main/exam-record'
import { registerIpc } from '../src/main/ipc'
const data = join(root, 'data'), records = new ExamRecords(data, engine)
// The lab also proved a new criteria epoch. Reopen its preserved final instead.
for (const record of records.list(join(root, 'examen.yaml'), group.id)) {
 if (record.id !== final.record.id) rmSync(records.directory(record), { recursive: true, force: true })
}
writeFileSync(join(root, 'examen.yaml'), readFileSync(join(records.directory(final.record), 'examen.yaml')))
writeFileSync(join(data, 'settings.json'), JSON.stringify({ enginePath: engine }))
writeFileSync(join(data, 'classes.json'), JSON.stringify({ classes: [group] }))
writeFileSync(join(data, 'projects.json'), JSON.stringify({ recent: [{ dir: root, name: 'Ficticio' }] }))
app.setPath('userData', data); app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
 registerIpc()
 const errors: string[] = []
 async function open(seed: boolean) {
  const win = new BrowserWindow({ width: 1366, height: 768, show: false,
   webPreferences: { preload: resolve('out/preload/index.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, offscreen: true } })
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message) })
  // Same origin as the real renderer. Seed only the selected class on first
  // visit; the application discovers the recent exam without an open action.
  console.log('recovery window', seed ? 'seed' : 'reopen')
  if (seed) {
   await win.loadFile(resolve('out/renderer/index.html'))
   await win.webContents.executeJavaScript(`localStorage.setItem('heimdall-class-id', ${JSON.stringify(group.id)});localStorage.setItem('heimdall-class-for:'+${JSON.stringify(root)}, ${JSON.stringify(group.id)});localStorage.removeItem('heimdall-last-project')`)
   await new Promise(resolve => setTimeout(resolve, 500))
   const loaded = new Promise<void>(resolve => win.webContents.once('did-finish-load', () => resolve()))
   win.reload()
   await loaded
  } else await win.loadFile(resolve('out/renderer/index.html'))
  for (let attempt = 0; attempt < 60; attempt++) {
   const text = await win.webContents.executeJavaScript('document.body.innerText').catch(() => '')
   if (text.includes('Examen finalizado') && text.includes('Mejores notas')) return win
   await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('The real renderer did not restore the finalized exam: '+await win.webContents.executeJavaScript('document.body.innerText'))
 }
 const first = await open(true)
 assert.ok((await first.webContents.executeJavaScript('document.body.innerText')).includes('Examen finalizado'))
 await first.webContents.session.flushStorageData()
 first.destroy()
 await new Promise(resolve => setTimeout(resolve, 100))
 const second = await open(false)
 const text = await second.webContents.executeJavaScript('document.body.innerText')
 assert.ok(text.includes('Examen finalizado')); assert.ok(text.includes('Mejores notas')); assert.ok(!text.includes('Próxima corrección en'))
 const saved = await second.webContents.executeJavaScript(`window.heimdall.savedExam(${JSON.stringify(join(root, 'examen.yaml'))},${JSON.stringify(group.id)})`)
 assert.equal(saved.record.closedAt, final.record.closedAt)
 assert.equal(saved.session.students.find((s: any) => s.student_id === 'first').score.final_score,100)
 assert.deepEqual(errors, [])
 console.log(JSON.stringify({ reopen: 'verified with built main/preload/renderer', automaticRecent: true, bestScore: 100, closedAt: saved.record.closedAt, errors, syntheticRoot: root }, null, 2))
 second.destroy(); app.quit()
}).catch(error => { console.error(error); app.exit(1) })
