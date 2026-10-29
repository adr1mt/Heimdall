// Real main/preload/renderer recovery, with synthetic canonical evidence and no SSH.
import { app, BrowserWindow } from 'electron'
import assert from 'node:assert/strict'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { root, engine, group, final } from './exam-session-lab'
import { ExamRecords } from '../src/main/exam-record'
import { registerIpc } from '../src/main/ipc'
const data = join(root, 'data'), records = new ExamRecords(data, engine), exam = join(root, 'examen.yaml')
for (const record of records.list(exam, group.id)) {
 if (record.id !== final.record.id) rmSync(records.directory(record), { recursive: true, force: true })
}
writeFileSync(exam, readFileSync(join(records.directory(final.record), 'examen.yaml')))
// Simulate an unexpected application exit while this record was still open.
const interrupted = records.prepare(exam, group, true)
for (const round of final.record.rounds) records.append(interrupted, round.path)
writeFileSync(join(data, 'settings.json'), JSON.stringify({ enginePath: engine }))
writeFileSync(join(data, 'classes.json'), JSON.stringify({ classes: [group] }))
writeFileSync(join(data, 'projects.json'), JSON.stringify({ recent: [{ dir: root, name: 'Ficticio' }] }))
app.setPath('userData', data); app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
 registerIpc()
 const errors: string[] = []
 const wait = () => new Promise(resolve => setTimeout(resolve, 100))
 async function open(seed: boolean, paused: boolean) {
  const win = new BrowserWindow({ width: 1366, height: 768, show: false,
   webPreferences: { preload: resolve('out/preload/index.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, offscreen: true } })
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message) })
  await win.loadFile(resolve('out/renderer/index.html'))
  if (seed) {
   await win.webContents.executeJavaScript(`localStorage.setItem('heimdall-class-id', ${JSON.stringify(group.id)});localStorage.setItem('heimdall-class-for:'+${JSON.stringify(root)}, ${JSON.stringify(group.id)});localStorage.removeItem('heimdall-last-project')`)
   await new Promise(resolve => setTimeout(resolve, 500))
   const loaded = new Promise<void>(resolve => win.webContents.once('did-finish-load', () => resolve()))
   win.reload(); await loaded
  }
  for (let attempt = 0; attempt < 60; attempt++) {
   const ready = await win.webContents.executeJavaScript(paused
     ? `document.body.innerText.includes('Pausado') && document.querySelector('.matrix-viewport') !== null`
     : `document.querySelector('[data-testid="final-grades"]') !== null`).catch(() => false)
   if (ready) return win
   await wait()
  }
  throw new Error('Recovery failed: '+await win.webContents.executeJavaScript('document.body.innerText'))
 }
 const first = await open(true, true)
 const query = `window.heimdall.savedExam(${JSON.stringify(exam)},${JSON.stringify(group.id)})`
 const paused = await first.webContents.executeJavaScript(query)
 assert.equal(paused.record.state, 'PAUSED'); assert.equal(paused.record.id, interrupted.id)
 assert.equal(paused.record.closedAt, undefined); assert.equal(paused.record.rounds.length, 3)
 assert.equal(paused.session.students.find((s: any) => s.student_id === 'first').score.final_score, 100)
 await first.webContents.session.flushStorageData(); first.destroy(); await wait()
 const second = await open(false, true)
 const closed = await second.webContents.executeJavaScript(`window.heimdall.finishExam(${JSON.stringify(exam)},${JSON.stringify(group.id)},70,${JSON.stringify(interrupted.id)})`)
 assert.equal(closed.record.state, 'FINALIZED'); assert.equal(closed.record.id, interrupted.id)
 second.destroy(); await wait()
 const third = await open(false, false)
 const text = await third.webContents.executeJavaScript('document.body.innerText')
 assert.ok(text.includes('Examen finalizado')); assert.ok(!/Vuelta|vueltas|Próxima corrección/.test(text))
 const saved = await third.webContents.executeJavaScript(query)
 assert.equal(saved.record.closedAt, closed.record.closedAt)
 assert.equal(saved.session.students.find((s: any) => s.student_id === 'first').score.final_score, 100)
 assert.equal(await third.webContents.executeJavaScript(`document.querySelector('.matrix-viewport') === null`), true)
 assert.deepEqual(errors, [])
 console.log(JSON.stringify({ reopen: 'verified with real main/preload/renderer', interruptedOpenBecomesPaused: true,
   pausedReopen: true, finalListReopen: true, preservedBestAfterSshFailure: true, automaticRecent: true,
   bestScore: 100, closedAt: saved.record.closedAt, errors, syntheticRoot: root }, null, 2))
 third.destroy(); app.quit()
}).catch(error => { console.error(error); app.exit(1) })
