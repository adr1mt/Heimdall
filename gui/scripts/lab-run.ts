// Acceptance harness for T052: corrects a lab exam through the real
// application — the real preload, the real IPC and the real views — and
// reports what the screen ended up saying. Not part of the application.
//
//   HEIMDALL_ENGINE=../bin/heimdall PROJECT=<dir> CANCEL_MS=1500 \
//     npm run lab-run
//
// The only thing it fakes is the system file chooser, which cannot be clicked
// from a script; the path it returns travels the same way the teacher's would.
import { app, BrowserWindow, dialog } from 'electron'
import { join, resolve } from 'node:path'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { registerIpc } from '../src/main/ipc'
import { writeSettings } from '../src/main/store'

const root = process.cwd()
const project = resolve(process.env.PROJECT || '')
const enginePath = resolve(process.env.HEIMDALL_ENGINE || '')
// The password arrives in a file the harness deletes right away, never in the
// environment: `LAB_SECRET=… npm run` would put it in this process's environ,
// which is exactly what scripts/secretos.sh is looking for.
const secret = readSecret(process.env.LAB_SECRET_FILE)

function readSecret(path: string | undefined): string {
  if (!path) return ''
  const value = readFileSync(path, 'utf-8').trim()
  rmSync(path, { force: true })
  return value
}
const cancelMs = Number(process.env.CANCEL_MS || 0)
const shot = process.env.SHOT_OUT || ''
// Where the fake «save as» dialog says the teacher pointed, for X-1.
const csvOut = process.env.CSV_OUT || ''

const picks = [join(project, 'examen.yaml'), join(project, 'aula.yaml')]
let pick = 0
dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [picks[pick++]] })) as never

dialog.showSaveDialog = (async () => ({ canceled: !csvOut, filePath: csvOut })) as never

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  writeSettings(app.getPath('userData'), { enginePath })
  registerIpc()

  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    show: true,
    backgroundColor: '#0b0f19',
    webPreferences: {
      preload: join(root, 'out/preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  await win.loadFile(join(root, 'out/renderer/index.html'))
  await wait(1500)

  const js = win.webContents.executeJavaScript.bind(win.webContents)

  // Listen on the same bridge the views use, to report the exit code the
  // engine ended with: the screen shows what happened, not the number.
  await js(`(() => {
    window.__heimdall_end = null
    window.heimdall.onRunEvent((e) => { if (e.event === 'run.end') window.__heimdall_end = e })
    window.heimdall.onRunClosed((c) => { window.__heimdall_closed = c })
    return 'ok'
  })()`)

  // Click «Elegir…» twice: the exam first, then the classroom.
  await js(`[...document.querySelectorAll('button')].filter(b => b.textContent.includes('Elegir'))[0].click()`)
  await wait(400)
  await js(`[...document.querySelectorAll('button')].filter(b => b.textContent.includes('Elegir'))[1].click()`)
  await wait(800)

  // Type the password the way a person does: React only sees a real input event.
  await js(`(() => {
    const input = document.querySelector('input[type=password]')
    if (!input) return 'sin campo de contraseña'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(secret)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  })()`).then((r) => console.log('[lab-run] contraseña:', r))
  await wait(300)

  await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Corregir').click()`)
  console.log('[lab-run] corrigiendo…')

  if (cancelMs > 0) {
    await wait(cancelMs)
    await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Detener').click()`)
    await wait(300)
    await js(`[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Detener').pop().click()`)
    console.log('[lab-run] detener pulsado')
  }

  // Wait for the run to be over: the application opens the artifact by itself
  // and lands on Resultados, so that is what says it finished.
  for (let i = 0; i < 120; i++) {
    await wait(500)
    const done = await js(
      `!!document.querySelector('main')?.innerText.match(/de peso total|Corregir otra vez/)`
    )
    if (done) break
  }

  // H-1 of T054: the same correction, reopened from the history, has to say
  // exactly what it said the day it ran. The text of Resultados is captured
  // before going anywhere, and again after opening the top row of Histórico.
  const live = (await js(`document.querySelector('main').innerText`)) as string
  await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Histórico').click()`)
  await wait(800)
  const opened = await js(`(() => {
    const row = [...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Abrir')
    if (row) row.click()
    return !!row
  })()`)
  await wait(800)
  const again = (await js(`document.querySelector('main').innerText`)) as string
  console.log('[lab-run] historico abierto:', opened)
  console.log('[lab-run] historico:', opened && again === live ? 'igual' : 'distinto')
  if (opened && again !== live) {
    console.log('----- historico -----')
    console.log(again)
    console.log('---------------------')
  }

  // X-1 of T056: take the grades out through the real button and the real
  // save dialog. What lands on disk is what the teacher would get.
  if (csvOut) {
    const clicked = await js(`(() => {
      const open = [...document.querySelectorAll('main button')]
        .find(b => b.textContent.includes('Exportar notas'))
      if (open) open.click()
      return !!open
    })()`)
    await wait(400)
    const saved = await js(`(() => {
      const yes = [...document.querySelectorAll('button')]
        .find(b => b.textContent.trim() === 'Guardar el fichero')
      if (yes) yes.click()
      return !!yes
    })()`)
    await wait(800)
    console.log('[lab-run] exportar:', clicked && saved ? 'ok' : `boton=${clicked} confirmar=${saved}`)
  }

  // Open one check, which is where the cause and the output live.
  if (process.env.OPEN_CHECK) {
    await js(`(() => {
      const cell = [...document.querySelectorAll('main button')]
        .find(b => b.textContent.trim() === ${JSON.stringify(process.env.OPEN_CHECK)})
      if (cell) cell.click()
      return !!cell
    })()`).then((r) => console.log('[lab-run] comprobación abierta:', r))
    await wait(400)
  }

  const progress = await js(
    `document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') ?? 'sin barra'`
  )
  const text = (await js(`document.querySelector('main').innerText`)) as string
  if (shot) writeFileSync(shot, (await win.webContents.capturePage()).toPNG())

  const end = await js(`window.__heimdall_end && { status: window.__heimdall_end.status, exit_code: window.__heimdall_end.exit_code, artifact: window.__heimdall_end.artifact }`)
  const closed = await js(`window.__heimdall_closed`)

  console.log('[lab-run] barra:', progress)
  console.log('[lab-run] run.end:', JSON.stringify(end))
  console.log('[lab-run] proceso:', JSON.stringify(closed))
  console.log('----- pantalla -----')
  console.log(text)
  console.log('--------------------')
  app.quit()
})
