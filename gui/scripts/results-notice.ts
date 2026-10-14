// T177: real renderer/preload, temporary profile and a controlled read failure.
// No SSH or teacher data. Run after gui-build from gui/ using Electron.
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join, resolve } from 'node:path'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { registerIpc } from '../src/main/ipc'
import { createProjectAt } from '../src/main/projects'
import { IPC } from '../src/shared/ipc'
import { validRun } from '../tests/fixtures/valid-run'

const profile = mkdtempSync(join(tmpdir(), 'heimdall-results-notice-'))
const project = join(profile, 'exam')
const out = resolve(process.env.NOTICE_OUT || '/tmp/heimdall-results-notice')
app.setPath('userData', profile)
app.disableHardwareAcceleration()
dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [project] })) as never
const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))
let failRead = true

app.whenReady().then(async () => {
  mkdirSync(out, { recursive: true })
  createProjectAt(project)
  registerIpc()
  ipcMain.removeHandler(IPC.readArtifact)
  ipcMain.handle(IPC.readArtifact, () => {
    if (failRead) throw new Error('Lectura de prueba no disponible')
    return validRun()
  })
  const win = new BrowserWindow({
    width: 1280, height: 820, show: true,
    webPreferences: {
      preload: resolve('out/preload/index.cjs'), sandbox: true,
      contextIsolation: true, nodeIntegration: false
    }
  })
  const js = win.webContents.executeJavaScript.bind(win.webContents)
  async function capture(name: string): Promise<void> {
    // Wait for layout/animations to reach the compositor after DOM assertions.
    await wait(350)
    writeFileSync(join(out, name), (await win.webContents.capturePage()).toPNG())
  }
  async function until(expression: string): Promise<void> {
    for (let i = 0; i < 100; i++) {
      if (await js(expression)) return
      await wait(50)
    }
    throw new Error(`Visible assertion failed: ${expression}`)
  }
  async function click(text: string, scope = 'body'): Promise<void> {
    const expression = `(()=>{const b=[...document.querySelectorAll('${scope} button')].find(b=>b.textContent.trim().includes(${JSON.stringify(text)})); if(b){b.click();return true}return false})()`
    await until(expression)
  }
  function finish(): void {
    win.webContents.send(IPC.runEvent, {
      event: 'run.end', seq: 1, ts: new Date().toISOString(),
      status: 'COMPLETE', exit_code: 0, artifact: join(project, 'var/run-R1.json'),
      counts: { students: 1, pass: 1, fail: 0, unevaluated: 0 }
    })
  }
  await win.loadFile(resolve('out/renderer/index.html'))
  await click('Abrir', 'header')
  await until(`document.querySelector('main')?.innerText.includes('Corregir')`)
  // The event goes through the actual App subscription, without changing views.
  finish()
  await until(`[...document.querySelectorAll('[role="alert"]')].some(e=>e.textContent.includes('No se pudo abrir el resultado') && e.textContent.includes('Lectura de prueba no disponible'))`)
  await until(`!document.querySelector('main').innerText.includes('siguiente entrega')`)
  await capture('notice.png')
  // Clear the notice, then trigger the failure while projecting.
  await js(`document.querySelector('main [role="alert"] button').click()`)
  await js(`[...document.querySelectorAll('aside button')].find(b=>b.textContent.includes('Modo proyector')).click()`)
  await until(`document.documentElement.classList.contains('projector')`)
  finish()
  await until(`[...document.querySelectorAll('[role="alert"]')].some(e=>e.textContent.includes('No se pudo abrir el resultado'))`)
  await capture('notice-projector.png')
  await js(`document.querySelector('main [role="alert"] button').click()`)
  failRead = false
  finish()
  await until(`document.querySelector('main')?.innerText.includes('Ficticio') && document.querySelector('main')?.innerText.includes('Resultados')`)
  await capture('results-projector.png')
  console.log('PASS: visible read error, projector error, successful results navigation')
  win.destroy()
  rmSync(profile, { recursive: true, force: true })
  app.exit(0)
}).catch(error => {
  console.error(error)
  app.exit(1)
})
