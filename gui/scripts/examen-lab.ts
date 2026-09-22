// Acceptance harness for T058 and T064: exam mode as a session, projector mode
// and the confirmation when the window is closed, driven through the real
// application — the real
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
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { guardClose } from '../src/main/close-guard'
import { registerIpc } from '../src/main/ipc'
import { openExamAndClass, writeLabClass } from './lab-flow'
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

/**
 * What the engine says an exam session is worth, straight from the binary.
 * Exit 3 —somebody still without a closed grade— prints the session all the
 * same, and it is the ordinary case in the lab: alumne02's machine is not
 * there.
 */
function engineSession(rounds: string[]): string {
  try {
    return execFileSync(enginePath, ['session', ...rounds], { encoding: 'utf-8' })
  } catch (error) {
    const failed = error as { status?: number; stdout?: string; stderr?: string }
    if (failed.status === 3 && failed.stdout) return failed.stdout
    throw new Error(`heimdall session falló (${failed.status}): ${failed.stderr ?? ''}`)
  }
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
  guardClose(win)
  await win.loadFile(join(root, 'out/renderer/index.html'))
  await wait(1500)

  const js = win.webContents.executeJavaScript.bind(win.webContents)
  const screen = (): Promise<string> => js(`document.querySelector('main').innerText`) as Promise<string>
  const click = (text: string): Promise<boolean> =>
    js(`(() => {
      const b = [...document.querySelectorAll('main button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})
      if (b) b.click()
      return !!b
    })()`) as Promise<boolean>

  // Count the passes the way the screen does: one run.start per pass.
  await js(`(() => {
    window.__passes = 0
    window.heimdall.onRunEvent((e) => { if (e.event === 'run.start') window.__passes += 1 })
    return 'ok'
  })()`)

  await openExamAndClass(js, classId, secret)

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
  // It is read in «Corregir», which is where the exam is driven from (T115).
  await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Corregir').click()`)
  await wait(600)
  const home = await screen()
  // The countdown is one of the five readings of the strip since T103:
  // «Siguiente» over «3 min» or «ahora».
  check(
    'E-5',
    /(\d+ min|\d+ s|ahora)\s*\n?\s*SIGUIENTE/i.test(home),
    'la cuenta atrás de la siguiente vuelta está en pantalla'
  )

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

  // The session, which is what the exam is really worth (T064). It needs two
  // rounds, so it rides along with the chain.
  if (chain) {
    // The rounds on disk, oldest first: the same list the application sends
    // to the engine.
    const varDir = join(project, 'var')
    const rounds = readdirSync(varDir)
      .filter((name) => /^run-.*\.json$/.test(name))
      .map((name) => join(varDir, name))
      .map((path) => ({ path, run: JSON.parse(readFileSync(path, 'utf-8')) }))
      .sort((a, b) => String(a.run.finished_at).localeCompare(String(b.run.finished_at)))

    check('S-1', rounds.length >= 2, `vueltas guardadas: ${rounds.length}`)

    // What the engine says the session is worth. The screen may not differ
    // from this by a single number: the application computes no grade.
    const session = JSON.parse(engineSession(rounds.map((r) => r.path)))

    await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Corregir').click()`)
    await wait(2500)
    const panel = await screen()
    if (process.env.DUMP === '1') {
      console.log('----- panel de la sesión -----')
      console.log(panel)
      console.log('------------------------------')
    }

    const best = session.students.filter((s: { from_round: number }) => s.from_round > 0)
    const shown = best.every(
      (s: { name: string; from_round: number; score: { final_score: number } }) =>
        panel.includes(s.name) &&
        panel.includes(`Sale de la vuelta ${s.from_round}`) &&
        panel.includes(String(s.score.final_score))
    )
    check('S-2', best.length > 0 && shown, `alumnos con nota de sesión en pantalla: ${best.length}`)

    // Nobody without a whole round gets a number on the screen.
    const ungraded = session.students.filter((s: { from_round: number }) => s.from_round === 0)
    const honest = ungraded.every((s: { reason: string }) => panel.includes(s.reason))
    check('S-3', honest, `alumnos sin nota, con su motivo en pantalla: ${ungraded.length}`)

    // A student the session finished is left out of the next round, and the
    // round says why instead of giving them a zero.
    const finished = session.students.filter((s: { status: string }) => s.status === 'FINISHED')
    if (finished.length > 0) {
      const last = rounds[rounds.length - 1].run
      const left = finished.every((f: { student_id: string }) => {
        const inRound = last.students.find(
          (s: { student_id: string }) => s.student_id === f.student_id
        )
        return inRound && inRound.status === 'EXCLUDED' && /ya tenía el examen entero bien/.test(
          JSON.stringify(inRound)
        )
      })
      check('S-4', left, `terminados dejados fuera de la última vuelta: ${finished.length}`)
    } else {
      console.log(`PEND  S-4    ningún alumno terminó el examen entero en el laboratorio`)
    }
  }

  // P-1: on the projector, no machine address anywhere on the screen.
  await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Resultados').click()`)
  await wait(600)
  await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Modo proyector').click()`)
  await wait(400)
  // Open a check, which is where the command, the output and the technical
  // reason live. The last one belongs to the student whose machine never
  // answered: there the reason names the machine and there is no command to
  // read it from (T066).
  //
  // It is opened from «Matriz»: that is the view with one cell per check, and
  // the one the class is looking at while the exam runs. «Lista» is the
  // student-by-student reading and has no cell to click (T118).
  await js(`[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Matriz').click()`)
  await wait(600)
  // A cell shows the glyph of its state —that is what reads from the back
  // row— and carries who and which check in its aria-label. The one that is
  // wanted is unevaluated: there the reason names the machine and there is no
  // command to read it from.
  const opened = await js(`(() => {
    const cells = [...document.querySelectorAll('main button[aria-label]')]
      .filter(b => /: Sin evaluar$/.test(b.getAttribute('aria-label')))
    const cell = cells[cells.length - 1]
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
  check('P-0', opened === true, 'el detalle técnico de una comprobación se abre')
  check('P-1', !/\b\d{1,3}(\.\d{1,3}){3}\b/.test(projected), 'ninguna dirección IP en pantalla')
  check('P-2', projected.includes('•'), 'la máquina aparece tapada')
  const big = await js(`getComputedStyle(document.documentElement).fontSize`)
  check('P-3', big === '20px', `tamaño de letra proyectada: ${big}`)

  // P-4 y P-5: la barra lateral es del profesor, no de la clase, y se sale
  // del modo con una sola acción (T111).
  const sidebar = await js(`document.querySelectorAll('aside').length`)
  check('P-4', sidebar === 0, `barras laterales en pantalla: ${sidebar}`)
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })), true`)
  await wait(500)
  const backSidebar = await js(`document.querySelectorAll('aside').length`)
  check('P-5', backSidebar === 1, 'Esc devuelve la barra lateral')

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
