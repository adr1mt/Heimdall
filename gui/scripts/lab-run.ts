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
import { openExamAndClass, writeLabClass } from './lab-flow'
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

// The only thing the teacher opens now is the project's folder: the exam is
// found inside it and the classroom is written from the chosen class before
// every correction (ADR-0022, T108).
// «Abrir» asks for a folder —the project— and the rest of the application
// still asks for single files; whichever fits travels the way the teacher's
// would.
dialog.showOpenDialog = (async (options?: Electron.OpenDialogOptions) => ({
  canceled: false,
  filePaths: [
    options?.properties?.includes('openDirectory') ? project : join(project, 'examen.yaml')
  ]
})) as never

dialog.showSaveDialog = (async () => ({ canceled: !csvOut, filePath: csvOut })) as never

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  writeSettings(app.getPath('userData'), { enginePath })
  const classId = writeLabClass(app.getPath('userData'))
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

  // The exam in Inicio, the class in Corregir and the password typed: the
  // same three steps the teacher takes.
  await openExamAndClass(js, classId, secret)

  await js(`[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Corregir').click()`)
  console.log('[lab-run] corrigiendo…')

  if (cancelMs > 0) {
    await wait(cancelMs)
    await js(`[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Detener').click()`)
    await wait(300)
    await js(`[...document.querySelectorAll('main button')].filter(b => b.textContent.trim() === 'Detener').pop().click()`)
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

  // B-1 and B-2 of T113: the safety copy is made by itself when the
  // correction ends, and deleting the exam's folder does not take the grades
  // with it. The folder is deleted from here —the teacher would do it from
  // the file manager— and everything after it goes through the real buttons.
  if (process.env.CHECK_BACKUPS) {
    const copies = (await js(
      `window.heimdall.listBackups(${JSON.stringify(join(project, 'examen.yaml'))}).then(b => b.length)`
    )) as number
    console.log('[lab-run] copias:', copies)

    rmSync(join(project, 'var'), { recursive: true, force: true })
    await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Histórico').click()`)
    await wait(600)
    await js(`[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Actualizar').click()`)
    await wait(600)
    const restored = await js(`(() => {
      const button = [...document.querySelectorAll('main button')]
        .find(b => b.textContent.includes('Restaurar las notas'))
      if (button) button.click()
      return !!button
    })()`)
    await wait(1000)
    const reopened = await js(`(() => {
      const row = [...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Abrir')
      if (row) row.click()
      return !!row
    })()`)
    await wait(800)
    const recovered = (await js(`document.querySelector('main').innerText`)) as string
    console.log('[lab-run] restaurar:', restored && reopened ? 'ok' : `boton=${restored} abrir=${reopened}`)
    console.log('----- recuperado -----')
    console.log(recovered)
    console.log('----------------------')
    await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Resultados').click()`)
    await wait(600)
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

  // VIEW switches Resultados to «Matriz» or «Lista» before the capture: the
  // README shows the matrix, which is the view that says something about a
  // whole class at once.
  if (process.env.VIEW) {
    await js(`(() => {
      const tab = [...document.querySelectorAll('main button')]
        .find(b => b.textContent.trim() === ${JSON.stringify(process.env.VIEW)})
      if (tab) tab.click()
      return !!tab
    })()`).then((r) => console.log('[lab-run] vista:', process.env.VIEW, r))
    await wait(600)
  }

  const progress = await js(
    `document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') ?? 'sin barra'`
  )
  const text = (await js(`document.querySelector('main').innerText`)) as string
  if (shot) {
    // Give the view a beat to paint before the capture: a screenshot taken in
    // the same tick as the last click comes out half rendered.
    await wait(1500)
    writeFileSync(shot, (await win.webContents.capturePage()).toPNG())
  }

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
