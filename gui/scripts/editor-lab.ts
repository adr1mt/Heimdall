// Acceptance harness for T109: writes an exam from the application's form and
// corrects a lab class with it. Not part of the application.
import { app, BrowserWindow, dialog } from 'electron'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { registerIpc } from '../src/main/ipc'
import { createProjectAt } from '../src/main/projects'
import { writeLabClass } from './lab-flow'
import { writeGeneratedAula } from '../src/main/aula'
import { readClasses } from '../src/main/classes'
import { writeSettings } from '../src/main/store'

const root = process.cwd()
const enginePath = resolve(process.env.HEIMDALL_ENGINE || '')
const secret = process.env.LAB_SECRET || ''
const project = join(mkdtempSync(join(tmpdir(), 'heimdall-editor-')), 'examen del editor')
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

app.setPath('userData', mkdtempSync(join(tmpdir(), 'heimdall-editor-profile-')))

let failed = false
function check(id: string, ok: boolean, detail: string): void {
  if (!ok) failed = true
  console.log(`${ok ? 'OK    ' : 'FALLO '} ${id.padEnd(5)} ${detail}`)
}

dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [project] })) as never

app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  writeSettings(app.getPath('userData'), { enginePath })
  const classId = writeLabClass(app.getPath('userData'))
  createProjectAt(project)
  registerIpc()

  const win = new BrowserWindow({
    width: 1280, height: 900, show: true, backgroundColor: '#0b0f19',
    webPreferences: { preload: join(root, 'out/preload/index.cjs'), sandbox: false, contextIsolation: true, nodeIntegration: false }
  })
  win.webContents.on('console-message', (_event, level, message)=>console.log('[renderer]',level,message))
  await win.loadFile(join(root, 'out/renderer/index.html'))
  await wait(1500)
  const js = win.webContents.executeJavaScript.bind(win.webContents)
  const screen = (): Promise<string> => js(`document.querySelector('main').innerText`) as Promise<string>
  const click = (text: string, scope = 'main'): Promise<boolean> =>
    js(`(() => {
      const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})
      if (b) b.click(); return !!b
    })()`) as Promise<boolean>
  const type = (label: string, value: string): Promise<string> =>
    js(`(() => {
      const el = [...document.querySelectorAll('input, textarea')].find(i => {
        const lab = i.closest('label')
        return (lab && lab.textContent.includes(${JSON.stringify(label)})) || i.getAttribute('aria-label') === ${JSON.stringify(label)}
      })
      if (!el) return 'no está: ' + ${JSON.stringify(label)}
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)})
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return 'ok'
    })()`) as Promise<string>

  // Abrir el proyecto y elegir la clase en Corregir, como el profesor.
  await js(`[...document.querySelectorAll('header button')].find(b => b.textContent.includes('Abrir')).click()`)
  await wait(900)
  await js(`(() => {
    const s = document.querySelector('select')
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(classId)})
    s.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await wait(600)

  // Exámenes: añadir un grupo y una comprobación desde el formulario.
  await js(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'El examen').click()`)
  await wait(700)
  // El nombre del grupo vive en un campo; lo que se lee en pantalla es la
  // comprobación con la que nace un examen nuevo.
  check('D-1', /responde/.test(await screen()), 'el examen del proyecto se abre en el formulario')

  await click('Añadir grupo')
  await wait(300)
  await js(`(() => {
    const inputs = [...document.querySelectorAll('input[aria-label="Nombre del grupo"]')]
    const el = inputs[inputs.length - 1]
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Cuentas')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await wait(200)
  await js(`[...document.querySelectorAll('main button')].filter(b => b.textContent.trim() === 'Añadir comprobación').pop().click()`)
  await wait(500)
  console.log('[editor]', await type('Identificador', 'cuenta-alumno'))
  console.log('[editor]', await type('Qué se comprueba', 'La cuenta del alumno existe'))
  console.log('[editor]', await type('Comando', 'id -un'))
  console.log('[editor]', await type('Valor esperado', 'alumno'))
  await wait(300)
  await js(`(() => {
    const s = [...document.querySelectorAll('select')].find(s => s.querySelector('option[value="igual_a"]'))
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'igual_a')
    s.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await wait(300)
  await click('Guardar')
  await wait(500)

  // La vista YAML enseña lo mismo que se acaba de escribir en el formulario.
  await click('Ver el YAML')
  await wait(500)
  const yaml = (await js(`document.querySelector('textarea').value`)) as string
  check('D-2', /cuenta-alumno/.test(yaml) && /igual_a/.test(yaml), 'lo del formulario está en el YAML')

  // Y al revés: se escribe en el YAML y vuelve al formulario.
  console.log('[editor]', await type('Ver el YAML', yaml.replace('La cuenta del alumno existe', 'Escrito en el YAML')))
  await wait(400)
  await click('Volver al formulario')
  await wait(500)
  check('D-3', /Escrito en el YAML/.test(await screen()), 'lo del YAML está en el formulario')

  // Un examen inválido: el mensaje del motor, con fichero y línea.
  const broken = yaml.replace('en: "host1"', 'en: "host9"')
  await click('Ver el YAML')
  await wait(400)
  console.log('[editor]', await type('Ver el YAML', broken))
  await wait(400)
  await click('Guardar el examen')
  await wait(4000)
  const said = await screen()
  check('D-4', /host9/.test(said) && /examen\.yaml:\d+/.test(said), 'el motor señala el error con fichero y línea')
  check('D-5', !readFileSync(join(project, 'examen.yaml'), 'utf-8').includes('host9'), 'un examen inválido no se ha escrito')

  // El bueno: se guarda y se corrige de verdad.
  console.log('[editor]', await type('Ver el YAML', yaml))
  await wait(400)
  await click('Guardar el examen')
  await wait(5000)
  const saved = readFileSync(join(project, 'examen.yaml'), 'utf-8')
  check('D-6', saved.includes('cuenta-alumno'), 'el examen del formulario está guardado en su carpeta')

  // Audit regressions: the visible draft is the only save candidate.
  const invalid = saved + '\nfoo: [\n'
  await type('Ver el YAML', invalid)
  await wait(100)
  const blocked = await js(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Guardar el examen').disabled`)
  check('A06-1', !!blocked, 'el borrador inválido bloquea Guardar')
  await click('Guardar el examen')
  await click('Volver al formulario')
  check('A06-2', await js(`document.querySelector('textarea').value`)===invalid, 'alternar vistas conserva el borrador inválido')
  check('A06-3', readFileSync(join(project,'examen.yaml'),'utf-8')===saved, 'no se guarda la última versión válida por error')
  await js(`[...document.querySelectorAll('aside button')].find(b=>b.textContent.trim()==='Histórico').click()`)
  await wait(100)
  check('A06-4', /Hay cambios sin guardar/.test(await js('document.body.innerText')), 'salir advierte de los cambios pendientes')
  await click('Cancelar', 'body')
  await wait(100)
  check('A06-5', await js(`document.querySelector('textarea').value`)===invalid, 'cancelar la salida conserva el borrador')
  await type('Ver el YAML', saved)
  await click('Guardar el examen')
  await wait(700)
  const annotated=saved+'\n# Texto conservado exactamente\n'
  await type('Ver el YAML', annotated)
  await click('Guardar el examen')
  await wait(700)
  check('A06-6', readFileSync(join(project,'examen.yaml'),'utf-8')===annotated, 'se guarda exactamente el YAML validado, incluidos comentarios')
  writeFileSync(join(project,'examen.yaml'),invalid)
  await js(`[...document.querySelectorAll('aside button')].find(b=>b.textContent.trim()==='Inicio').click()`)
  await wait(300)
  await js(`[...document.querySelectorAll('header button')].find(b=>b.textContent.includes('Abrir')).click()`)
  await wait(500)
  await js(`[...document.querySelectorAll('aside button')].find(b=>b.textContent.trim()==='El examen').click()`)
  await wait(300)
  check('A06-7', await js(`document.querySelector('textarea').value`)===invalid, 'abrir un fichero roto conserva su texto original')
  await type('Ver el YAML',saved)
  await click('Guardar el examen')
  await wait(700)

  // El aula sale de la clase, como en cada corrección (ADR-0022).
  const group = readClasses(app.getPath('userData'))[0]
  const cname = writeGeneratedAula(project, group)
  try {
    execFileSync(enginePath, ['run', '--secrets=stdin', `--cname=${cname}`, project], {
      input: `${JSON.stringify({ schema: 1, secrets: { AULA_PASSWORD: secret } })}\n`,
      encoding: 'utf-8',
      cwd: project
    })
  } catch (e) {
    const r = e as { status?: number; stdout?: string }
    check('D-7', r.status === 3 && /nota 100\/100/.test(r.stdout ?? ''), `corregido: ${(r.stdout ?? '').split('\n').filter(l => l.includes('alumne01')).join('')}`)
  }

  console.log(failed ? 'Hay fallos.' : 'El editor escribe exámenes que el motor corrige.')
  app.quit()
  process.exitCode = failed ? 1 : 0
}).catch(error=> {console.error(error);app.exit(1)})
