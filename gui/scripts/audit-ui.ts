// Scoped visual regression for audit A16. Uses only a temporary profile/class.
import { app, BrowserWindow, dialog } from 'electron'
import { join, resolve } from 'node:path'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { registerIpc } from '../src/main/ipc'
import { createProjectAt } from '../src/main/projects'
import { writeLabClass } from './lab-flow'
import { writeSettings } from '../src/main/store'
const root = process.cwd(), profile = mkdtempSync(join(tmpdir(), 'heimdall-visual-')), project = join(profile, 'exam'), out = resolve(process.env.AUDIT_UI_OUT || '/tmp/heimdall-ui')
app.setPath('userData', profile); mkdirSync(out, { recursive: true })
dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [project] })) as never
app.on('window-all-closed', () => { })
const wait = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))
app.whenReady().then(async () => {
  createProjectAt(project); writeLabClass(profile); writeSettings(profile, { enginePath: resolve('../bin/heimdall') }); registerIpc()
  const win = new BrowserWindow({ width: 1280, height: 820, show: true, webPreferences: { preload: join(root, 'out/preload/index.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
  await win.loadFile(join(root, 'out/renderer/index.html')); await wait(600)
  const js = win.webContents.executeJavaScript.bind(win.webContents)
  const click = (text: string, scope = 'body'): Promise<boolean> => js(`(()=>{const b=[...document.querySelectorAll('${scope} button')].find(b=>b.textContent.trim().includes(${JSON.stringify(text)}));if(b)b.click();return !!b})()`)
  await click('Abrir'); await wait(300); await click('El examen', 'aside'); await wait(300)
  // Capture a real shared destructive action before touching the draft.
  await js(`(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.getAttribute('aria-label')?.includes('grupo'));if(b)b.click()})()`)
  await wait(100)
  if (!await js(`!!document.querySelector('[role="alertdialog"]')`)) throw new Error('Missing removal dialog')
  for (const theme of ['dark', 'light']) {
    await js(`document.documentElement.classList.toggle('dark',${theme === 'dark'})`); await wait(100)
    writeFileSync(join(out, `destructive-${theme}.png`), (await win.webContents.capturePage()).toPNG())
  }
  await click('Cancelar'); await wait(100)
  // Capture the editor's error state and engine status in both themes and sizes.
  await click('Ver el YAML', 'main'); await wait(100)
  const original = await js(`document.querySelector('textarea').value`)
  await js(`(()=>{const e=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,e.value+'\\nfoo: [');e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  for (const theme of ['dark', 'light']) for (const width of [1280, 960]) {
    win.setSize(width, width === 960 ? 640 : 820)
    await js(`document.documentElement.classList.toggle('dark',${theme === 'dark'})`); await wait(100)
    await js(`document.querySelector('fieldset').scrollTop=10000`)
    if (await js(`document.querySelector('main').innerText.includes('Esta vista no se pudo mostrar')`)) throw new Error('Editor crashed')
    if (!await js(`document.querySelector('textarea[aria-invalid="true"]') && document.querySelector('[role="alert"]')`)) throw new Error('Missing draft error')
    writeFileSync(join(out, `editor-${theme}-${width}.png`), (await win.webContents.capturePage()).toPNG())
  }
  await js(`(()=>{const e=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(original)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  // A fresh window with an unavailable engine exercises the red sidebar state.
  writeSettings(profile, { enginePath: join(profile, 'missing-engine') })
  await win.reload(); await wait(500)
  for (const theme of ['dark', 'light']) {
    win.setSize(1280, 820); await js(`document.documentElement.classList.toggle('dark',${theme === 'dark'})`); await wait(100)
    if (!await js(`document.querySelector('aside').innerText.includes('Motor no encontrado')`)) throw new Error('Missing engine error')
    writeFileSync(join(out, `missing-${theme}.png`), (await win.webContents.capturePage()).toPNG())
  }
  console.log('Visual captures:', out); app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })
