// Real main process, menu, preload and Monaco; temporary profile and exam only.
import { app, BrowserWindow } from 'electron'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const base = mkdtempSync(join(tmpdir(), 'heimdall-zoom-'))
const profile = join(base, 'profile')
const project = join(base, 'exam')
mkdirSync(profile)
mkdirSync(project)
const yaml = 'examen: Demo de zoom\nversion: 1\nhosts: []\ngrupos:\n  - grupo: Demo\n    comprobaciones:\n      - id: uno\n        descripcion: Respuesta\n        valor: "si"\n        igual_a: "si"\n'
writeFileSync(join(project, 'examen.yaml'), yaml)
writeFileSync(join(profile, 'projects.json'), JSON.stringify({ recent: [{ dir: project, name: 'Demo' }] }))
app.setPath('userData', profile)
app.setPath('sessionData', profile)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
let win: BrowserWindow
const js = (code: string) => win.webContents.executeJavaScript(code)
async function until(code: string) {
  for (let i = 0; i < 200; i++) {
    if (await js(code)) return
    await delay(100)
  }
  throw new Error(`Timed out: ${code}\n${await js('document.body.innerText')}`)
}
async function click(label: string) {
  await js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button');b.click()})()`)
  await delay(200)
}
async function key(keyCode: string, modifiers = ['control']) {
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
  await delay(120)
}
async function scale(expected: number) {
  assert.equal(await js("Number(localStorage.getItem('heimdall-ui-zoom'))"), expected)
  assert.equal(await js("Number(getComputedStyle(document.documentElement).zoom)"), expected / 100)
  assert.equal(win.webContents.getZoomFactor(), 1, 'no second native zoom')
}
async function focusEditor() {
  const point = await js("(()=>{const r=document.querySelector('.monaco-editor').getBoundingClientRect();return {x:Math.round(r.x+100),y:Math.round(r.y+30)}})()")
  win.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 })
  win.webContents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 })
  await delay(150)
}
async function run() {
  await import('../src/main/index')
  await app.whenReady()
  for (let i = 0; i < 100 && !BrowserWindow.getAllWindows().length; i++) await delay(100)
  win = BrowserWindow.getAllWindows()[0]
  await until("!![...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='El examen' && !x.disabled)")
  await click('El examen')
  await until("!!document.querySelector('.monaco-editor textarea')")
  win.focus()
  win.webContents.focus()
  await focusEditor()
  await key('0')
  await scale(100)
  await key('=')
  await scale(110)
  await key('+')
  await scale(120)
  await key('+')
  await scale(120)
  await key('-')
  await scale(110)
  await key('0')
  await scale(100)
  for (let i = 0; i < 4; i++) await key('-')
  await scale(80)
  await key('0')
  await click('Comprobaciones disponibles')
  assert.equal(await js("document.querySelectorAll('#assertion-help section').length"), 5)
  await click('Comprobaciones disponibles')
  await focusEditor()
  await key('End', ['control'])
  await js("(()=>{const data=new DataTransfer();data.setData('text/plain','\\n# borrador conservado');document.activeElement.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));})()")
  await until("document.body.innerText.includes('Sin guardar')")
  await click('Comprobaciones disponibles')
  await click('Comprobaciones disponibles')
  assert.equal(await js("document.body.innerText.includes('Sin guardar')"), true)
  await focusEditor()
  await key('z')
  await until("!document.body.innerText.includes('Sin guardar')")
  await key('=')
  await scale(110)
  win.webContents.reload()
  await until("document.readyState==='complete' && !!document.querySelector('button')")
  await scale(110)
  await key('0')
  await click('El examen')
  await until("!!document.querySelector('.monaco-editor textarea')")
  await click('Comprobaciones disponibles')
  const out = resolve('../docs/reviews/evidence/T228')
  mkdirSync(out, { recursive: true })
  for (const width of [1024, 1280]) {
    win.setSize(width, 820)
    await key('+')
    await key('+')
    await delay(400)
    assert.ok(await js("document.querySelector('.monaco-editor').getBoundingClientRect().height") > 100)
    writeFileSync(join(out, `editor-${width}.png`), (await win.webContents.capturePage()).toPNG())
    await key('0')
  }
  assert.equal(readFileSync(join(project, 'examen.yaml'), 'utf8'), yaml)
  console.log('PASS: native keyboard, Monaco, zoom bounds/reset/persistence, no double zoom, help, draft and source preservation.', base)
  win.destroy()
  app.exit(0)
}
run().catch(error => { console.error(error); app.exit(1) })
