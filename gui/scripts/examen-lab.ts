// Acceptance harness for T058: exam mode, projector mode and the confirmation
// when the window is closed, driven through the real application — the real
// preload, the real IPC, the real views and the real close guard. Not part of
// the application.
//
//   HEIMDALL_ENGINE=../bin/heimdall PROJECT=<dir> LAB_SECRET_FILE=<file> \
//     CHAIN=1 npm run examen-lab
//
// The only things it fakes are the two system dialogs, which cannot be
// clicked from a script: the file chooser and the close warning.
import { app, BrowserWindow, dialog } from 'electron'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { guardClose } from '../src/main/close-guard'
import { registerIpc } from '../src/main/ipc'
import { writeSettings } from '../src/main/store'

const root = process.cwd()
const project = resolve(process.env.PROJECT || '')
const enginePath = resolve(process.env.HEIMDALL_ENGINE || '')
/** Wait for the second pass of the chain. It takes a whole interval. */
const chain = process.env.CHAIN === '1'

function readSecret(path: string | undefined): string {
  if (!path) return ''
  const value = readFileSync(path, 'utf-8').trim()
  rmSync(path, { force: true })
  return value
}
const secret = readSecret(process.env.LAB_SECRET_FILE)

const picks = [join(project, 'examen.yaml'), join(project, 'aula.yaml')]
let pick = 0
dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [picks[pick++]] })) as never

/** What the fake close warning answers, and how many times it was asked. */
let closeAnswer = 0
let closeAsked = 0
let closeMessage = ''
dialog.showMessageBoxSync = ((_win: unknown, options: { message: string }) => {
  closeAsked += 1
  closeMessage = options.message
  return closeAnswer
}) as never

app.on('window-all-closed', () => {
  // The harness prints its report after the last close; the default would
  // quit the process before it got there.
})

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

let failed = false
function check(id: string, ok: boolean, detail: string): void {
  if (!ok) failed = true
  console.log(`${ok ? 'OK    ' : 'FALLO '} ${id.padEnd(5)} ${detail}`)
}

/** How many engines are alive right now. The criterion is: never two. */
function enginesAlive(): number {
  try {
    const out = execFileSync('pgrep', ['-fa', `${enginePath} run`], { encoding: 'utf-8' })
    return out.split('\n').filter((line) => line.trim()).length
  } catch {
    return 0
  }
}

/**
 * Whether the password shows up in anything the application wrote. The
 * pattern travels in a file: `grep -F <clave>` would put it in grep's own
 * argv and the search would keep finding itself.
 */
function grep(needle: string, dirs: string[]): boolean {
  const pattern = join(app.getPath('temp'), 'heimdall-patron')
  writeFileSync(pattern, `${needle}\n`)
  try {
    execFileSync('grep', ['-rqFf', pattern, ...dirs])
    return true
  } catch {
    return false
  } finally {
    rmSync(pattern, { force: true })
  }
}

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
  guardClose(win)
  await win.loadFile(join(root, 'out/renderer/index.html'))
  await wait(1500)

  const js = win.webContents.executeJavaScript.bind(win.webContents)
  const screen = (): Promise<string> => js(`document.querySelector('main').innerText`) as Promise<string>
  const click = (text: string): Promise<boolean> =>
    js(`(() => {
      const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})
      if (b) b.click()
      return !!b
    })()`) as Promise<boolean>

  // Count the passes the way the screen does: one run.start per pass.
  await js(`(() => {
    window.__passes = 0
    window.heimdall.onRunEvent((e) => { if (e.event === 'run.start') window.__passes += 1 })
    return 'ok'
  })()`)

  await js(`[...document.querySelectorAll('button')].filter(b => b.textContent.includes('Elegir'))[0].click()`)
  await wait(400)
  await js(`[...document.querySelectorAll('button')].filter(b => b.textContent.includes('Elegir'))[1].click()`)
  await wait(800)
  await js(`(() => {
    const input = document.querySelector('input[type=password]')
    if (!input) return 'sin campo'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(secret)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  })()`)
  await wait(300)

  // E-1: the exam starts on its own, without pressing «Corregir».
  await click('Cada 5 min')
  const started = await click('Empezar el examen')
  check('E-1', started, 'el botón de empezar el examen existe')

  // E-2: while the pass runs, never two engines. Polled, not deduced.
  let most = 0
  let ended = false
  for (let i = 0; i < 240; i++) {
    await wait(250)
    most = Math.max(most, enginesAlive())
    if (/Corregir otra vez|de peso total/.test(await screen())) {
      ended = true
      break
    }
  }
  check('E-2', most <= 1, `motores a la vez durante la vuelta: ${most}`)
  check('E-3', ended, 'la primera vuelta terminó sola')
  const passes = await js(`window.__passes`)
  check('E-4', passes === 1, `vueltas lanzadas hasta aquí: ${passes}`)

  // E-5: the mode stays on between passes and says when the next one is due.
  await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Inicio').click()`)
  await wait(600)
  const home = await screen()
  check('E-5', /Siguiente vuelta en/.test(home), 'la cuenta atrás de la siguiente vuelta está en pantalla')

  // E-6: the chain really happens. One whole interval, so it is optional.
  if (chain) {
    let second = false
    for (let i = 0; i < 1600; i++) {
      await wait(250)
      most = Math.max(most, enginesAlive())
      if ((await js(`window.__passes`)) >= 2) {
        second = true
        break
      }
    }
    check('E-6', second, 'la segunda vuelta salió sola')
    check('E-7', most <= 1, `motores a la vez en toda la cadena: ${most}`)
    for (let i = 0; i < 240 && enginesAlive() > 0; i++) await wait(250)
  }

  // P-1: on the projector, no machine address anywhere on the screen.
  await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Resultados').click()`)
  await wait(600)
  await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Modo proyector').click()`)
  await wait(400)
  // Open a check, which is where the command and the output live.
  await js(`(() => {
    const cell = [...document.querySelectorAll('main button')].find(b => /^p\\d+-/.test(b.textContent.trim()))
    if (cell) cell.click()
    return !!cell
  })()`)
  await wait(500)
  const projected = await screen()
  if (process.env.DUMP === '1') {
    console.log('----- pantalla proyectada -----')
    console.log(projected)
    console.log('-------------------------------')
  }
  check('P-1', !/\b\d{1,3}(\.\d{1,3}){3}\b/.test(projected), 'ninguna dirección IP en pantalla')
  check('P-2', projected.includes('•'), 'la máquina aparece tapada')
  const big = await js(`getComputedStyle(document.documentElement).fontSize`)
  check('P-3', big === '20px', `tamaño de letra proyectada: ${big}`)

  // C-1: closing with the exam on asks, and «Seguir corrigiendo» keeps it open.
  closeAnswer = 0
  win.close()
  await wait(600)
  check('C-1', closeAsked === 1 && !win.isDestroyed(), `preguntó ${closeAsked} vez y la ventana sigue abierta`)
  check('C-2', closeMessage.includes('examen'), `lo que dijo: «${closeMessage}»`)

  // C-2: «Cerrar y detener» closes and turns the exam off.
  closeAnswer = 1
  win.close()
  await wait(800)
  check('C-3', closeAsked === 2, 'volvió a preguntar')

  // S-5: exam mode is the only thing in the application that keeps a
  // password from one pass to the next. It lives in the memory of the main
  // process; nothing it wrote may carry it.
  if (secret) {
    const written = grep(secret, [project, app.getPath('userData')])
    check('S-5', !written, written ? 'la contraseña aparece en algo escrito' : 'ninguna contraseña en lo escrito')
  }

  console.log(failed ? '\nRESULTADO: FALLO' : '\nRESULTADO: OK')
  app.exit(failed ? 1 : 0)
})
