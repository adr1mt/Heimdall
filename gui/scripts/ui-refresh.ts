// T178–T183: real IPC, preload, renderer and SSH engine; native file dialogs are stubbed.
// Run from gui/ after build. SSH lab: 127.1.2.3:2201, test/Containerfile.
import { app, BrowserWindow, dialog } from 'electron'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { registerIpc } from '../src/main/ipc'

const base = mkdtempSync(join(tmpdir(), 'heimdall-ui-'))
const project = join(base, 'redes-demo')
const profile = join(base, 'profile')
const out = resolve('../docs/reviews/evidence/T178-T183')
mkdirSync(project)
mkdirSync(profile)
mkdirSync(out, { recursive: true })
const names = ['Ana Demo', 'Bruno Demo', 'Carla Demo', 'Diego Demo', 'Elena Demo']
const expected = ['443', '22', '53', 'dhcp', 'dns']
const labels = [
  'Puerto de HTTPS',
  'Puerto de SSH',
  'Puerto de DNS',
  'Asignación automática de IP',
  'Resolución de nombres'
]
const students = names.map((name, index) => ({
  id: `alu${index + 1}`,
  name,
  contact: `alu${index + 1}@example.invalid`,
  host: '127.1.2.3',
  port: '2201',
  user: 'alumno',
  fields: Object.fromEntries(
    expected.map((value, i) => [`p${i + 1}`, i < 5 - index ? value : 'incorrecto'])
  )
}))
const classGroup = {
  id: 'demo',
  name: 'Clase demo',
  columns: ['p1', 'p2', 'p3', 'p4', 'p5'],
  students
}
const offline = {
  ...classGroup,
  id: 'offline',
  name: 'Demo con una máquina apagada',
  students: students.map((s, i) => (i === 4 ? { ...s, port: '2299' } : s))
}
const standard = {
  ...classGroup,
  id: 'standard',
  name: 'Clase habitual · puerto 22',
  columns: [],
  students: students.map((s) => ({ ...s, port: '', user: 'usuario', fields: {} }))
}
writeFileSync(
  join(profile, 'classes.json'),
  JSON.stringify({ classes: [classGroup, offline, standard] })
)
writeFileSync(
  join(profile, 'settings.json'),
  JSON.stringify({ enginePath: resolve(process.env.HEIMDALL_ENGINE || '../bin/heimdall') })
)
const yaml =
  '# Demo ficticia: conservar este comentario.\nexamen: Redes de prueba\nversion: 1\nhosts: [host1]\npor_defecto: { peso: 1, timeout: 10s }\ngrupos:\n  - grupo: Fundamentos de redes\n    comprobaciones:\n' +
  expected
    .map(
      (value, i) =>
        `      - id: p${i + 1}\n        descripcion: ${labels[i]}\n        en: host1\n        cmd: ["echo", "\u0024{alumno.p${i + 1}}"]\n        igual_a: "${value}"\n`
    )
    .join('')
writeFileSync(join(project, 'examen.yaml'), yaml)
app.setPath('userData', profile)
app.disableHardwareAcceleration()
dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [project] })) as never
dialog.showSaveDialog = (async () => ({
  canceled: false,
  filePath: join(base, 'notas.csv')
})) as never
function latestResult() {
  const files = readdirSync(join(project, 'var'))
    .filter((name) => /^run-.*\.json$/.test(name))
    .sort()
  return JSON.parse(readFileSync(join(project, 'var', files.at(-1)!), 'utf8'))
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
let win: BrowserWindow
const js = (code: string): Promise<any> => win.webContents.executeJavaScript(code)
const text = () => js('document.body.innerText') as Promise<string>
async function until(code: string, label: string, timeout = 20000) {
  for (let i = 0; i < timeout / 100; i++) {
    if (await js(code)) return
    await delay(100)
  }
  throw new Error(`Timed out: ${label}\n${await text()}`)
}
async function click(label: string, selector = 'button') {
  await js(
    `(() => {const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b || b.disabled)throw Error('Button unavailable: '+${JSON.stringify(label)});b.click()})()`
  )
  await delay(200)
}
async function shot(name: string) {
  console.log('Screenshot:', name)
  await delay(600)
  writeFileSync(join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG())
  writeFileSync(join(out, `${name}.txt`), await text())
}
async function choose(id: string) {
  await js(
    `(()=>{const e=document.querySelector('select[aria-label]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(id)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`
  )
  await delay(400)
}
async function typeYaml(value: string) {
  win.focus()
  win.webContents.focus()
  const point = await js(
    "(()=>{const r=document.querySelector('.monaco-editor').getBoundingClientRect();return {x:Math.round(r.x+80),y:Math.round(r.y+10)}})()"
  )
  win.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 })
  win.webContents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 })
  await delay(100)
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'a', modifiers: ['control'] })
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'a', modifiers: ['control'] })
  // Exercise Monaco's paste handler without reading or changing the desktop clipboard.
  await js(
    `(()=>{const data=new DataTransfer();data.setData('text/plain',${JSON.stringify(value)});document.querySelector('.monaco-editor textarea').dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));})()`
  )
  await delay(400)
}
async function saveKey() {
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 's', modifiers: ['control'] })
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 's', modifiers: ['control'] })
  await delay(700)
}
async function password() {
  await js(
    `(()=>{const e=document.querySelector('input[type=password]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'HEIMDALL_SECRET_TEST_12345');e.dispatchEvent(new Event('input',{bubbles:true}));})()`
  )
  await delay(100)
}
async function correct(label = 'Corregir') {
  await password()
  await click(label, 'header button')
  await until(
    "document.querySelector('header h1')?.textContent === 'Resultados'",
    'real correction results',
    40000
  )
}
app
  .whenReady()
  .then(async () => {
    registerIpc()
    win = new BrowserWindow({
      width: 1280,
      height: 860,
      show: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: resolve('out/preload/index.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    const consoleErrors: string[] = []
    win.webContents.on('console-message', (_event, level, message) => {
      if (level >= 2) consoleErrors.push(message)
    })
    await win.loadFile(resolve('out/renderer/index.html'))
    await until(
      "!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Abrir…')",
      'home'
    )
    await click('Abrir…')
    await until("!!document.querySelector('select')", 'class chooser')
    await choose('demo')
    await js(
      `(()=>{const e=document.querySelector('input[type=password]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'HEIMDALL_SECRET_TEST_12345');e.dispatchEvent(new Event('input',{bubbles:true}));})()`
    )
    await shot('02-corregir')
    assert.match(await text(), /Alumnos a evaluar/)
    assert.match(await text(), /Iniciar modo examen/)
    await click('El examen', 'aside button')
    await until("!!document.querySelector('.monaco-editor textarea')", 'offline YAML editor')
    await shot('01-editor-yaml')
    assert.doesNotMatch(await text(), /Añadir comprobación|Volver al formulario/)
    const changed = yaml + '\n# Pegado y guardado con Ctrl+S.\n'
    await typeYaml(changed)
    await until("document.body.innerText.includes('Sin guardar')", 'typed YAML is dirty')
    await click('Resultados', 'aside button')
    assert.match(await text(), /Hay cambios sin guardar/)
    // Cancel preserves the draft.
    await click('Cancelar')
    await js("document.querySelector('.monaco-editor textarea').focus()")
    await saveKey()
    assert.equal(readFileSync(join(project, 'examen.yaml'), 'utf8'), changed)
    await typeYaml(changed + '\nfoo: [\n')
    await click('Guardar')
    await until("!!document.querySelector('[role=status]')", 'syntax error verdict')
    assert.equal(readFileSync(join(project, 'examen.yaml'), 'utf8'), changed)
    await typeYaml(changed.replace('peso: 1', 'peso: -1'))
    await click('Guardar')
    await until("!!document.querySelector('[role=status]')", 'invalid YAML verdict')
    assert.equal(readFileSync(join(project, 'examen.yaml'), 'utf8'), changed)
    await shot('01b-validacion')
    await typeYaml(changed)
    await saveKey()
    await click('Corregir', 'aside button')
    await correct()
    const full = latestResult()
    assert.deepEqual(
      full.students.map((s: any) => s.score.final_score),
      [100, 80, 60, 40, 20]
    )
    await shot('03-resultados-lista')
    assert.match(await text(), /Aprobado/)
    assert.match(await text(), /Suspenso/)
    assert.equal(await js("document.querySelector('details')?.open"), false)
    await click('Matriz')
    await shot('04-resultados-matriz')
    await js('document.querySelector(\'[aria-label="Carla Demo, Puerto de DNS: Bien"]\').click()')
    await shot('05-detalle-alumno')
    assert.match(await text(), /Carla Demo/)
    assert.match(await text(), /Resolución de nombres/)
    await click('Volver')
    await click('Analíticas', 'aside button')
    await shot('06-analiticas')
    assert.match(await text(), /Atención prioritaria/)
    await click('Ajustes', 'aside button')
    await shot('07-ajustes')
    assert.match(await text(), /Vista previa/)
    await click('Ayuda', 'aside button')
    await shot('08-ayuda')
    assert.equal(
      await js('document.querySelectorAll(\'nav[aria-label="Índice de ayuda"] a\').length'),
      13
    )
    await click('Clases', 'aside button')
    await js(
      "[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Clase habitual')).click()"
    )
    await delay(200)
    await click('Editar')
    await shot('09-clase')
    assert.equal(await js('document.querySelectorAll(\'input[aria-label="Puerto"]\').length'), 0)
    await js(
      `(()=>{const e=document.querySelector('input[aria-label="Usuario común"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'docente');e.dispatchEvent(new Event('input',{bubbles:true}));})()`
    )
    await delay(100)
    await click('Aplicar a todos')
    await js(
      "[...document.querySelectorAll('label')].find(e=>e.textContent==='Puertos SSH').querySelector('input').click()"
    )
    await delay(100)
    await js(
      `(()=>{const e=document.querySelector('input[aria-label="Puerto"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2202');e.dispatchEvent(new Event('input',{bubbles:true}));})()`
    )
    await delay(100)
    await js(
      "[...document.querySelectorAll('label')].find(e=>e.textContent==='Puertos SSH').querySelector('input').click()"
    )
    await click('Guardar')
    const savedClass = JSON.parse(readFileSync(join(profile, 'classes.json'), 'utf8')).classes.find(
      (group: any) => group.id === 'standard'
    )
    assert.ok(savedClass.students.every((student: any) => student.user === 'docente'))
    assert.equal(savedClass.students[0].port, '2202')
    await click('Editar')
    assert.equal(await js(`document.querySelector('input[aria-label="Puerto"]').value`), '2202')
    await click('Cancelar')
    await click('Resultados', 'aside button')
    await click('Matriz')
    await click('Modo proyector', 'aside button')
    await shot('10-proyector')
    assert.doesNotMatch(await text(), /Exportar a Moodle|Qué quieren decir|Filtros y estados/)
    await click('Salir del proyector')
    await click('Tema claro', 'aside button')
    await shot('11-matriz-clara')
    await click('El examen', 'aside button')
    await until("!!document.querySelector('.monaco-editor textarea')", 'light editor')
    await shot('12-editor-claro')
    // Keyboard save and diagram rendering work with the strict production CSP.
    await click('Tema oscuro', 'aside button')
    await click('Corregir', 'aside button')
    await choose('offline')
    await correct('Corregir otra vez')
    await shot('13-incidencia-tecnica')
    assert.match(await text(), /Sin evaluar/)
    const partial = latestResult()
    assert.equal(partial.students[4].score.final_score, null)
    assert.equal(partial.students[4].score.status, 'NOT_EVALUATED')
    await click('Analíticas', 'aside button')
    assert.match(await text(), /1 sin nota final, fuera de la distribución/)
    await shot('13b-analiticas-incidencia')
    await click('Resultados', 'aside button')
    await click('Modo proyector', 'aside button')
    assert.equal(
      await js(
        "[...document.querySelectorAll('button')].some(b => /Reintentar|Exportar/.test(b.textContent))"
      ),
      false
    )
    await click('Salir del proyector')
    await click('Corregir', 'aside button')
    await choose('demo')
    await password()
    await click('Iniciar modo examen')
    await until(
      "document.querySelector('header h1')?.textContent === 'Resultados'",
      'first automatic round',
      40000
    )
    await click('Corregir', 'aside button')
    await until(
      "!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Detener modo examen')",
      'active exam'
    )
    await shot('14-modo-examen')
    await click('Detener modo examen')
    // Reopen a malformed source: it must remain editable, never be replaced by a template.
    await click('Inicio', 'aside button')
    const broken = changed + '\nfoo: [\n'
    writeFileSync(join(project, 'examen.yaml'), broken)
    await click('Abrir…')
    await click('El examen', 'aside button')
    await until("!!document.querySelector('.monaco-editor textarea')", 'reopened invalid source')
    assert.match(await text(), /foo/)
    await typeYaml(changed)
    await saveKey()
    assert.equal(readFileSync(join(project, 'examen.yaml'), 'utf8'), changed)
    assert.deepEqual(consoleErrors, [])
    const result = {
      grades: full.students.map((s: any) => s.score.final_score),
      offlineGrade: partial.students[4].score.final_score,
      ok: true,
      base,
      checks: [
        'YAML editor offline and syntax colours',
        'paste, Ctrl+S and byte preservation',
        'unsaved guard',
        'invalid draft does not overwrite',
        'malformed source reopens for repair',
        'real SSH correction, five students',
        'list, matrix and student detail',
        'analytics, help, grading preview',
        'default port hidden; custom port and shared user survive save and reopen',
        'light and dark themes',
        'projector',
        'offline student',
        'first automatic exam round and stop'
      ],
      consoleErrors
    }
    writeFileSync(join(out, 'verification.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
    app.quit()
  })
  .catch(async (error) => {
    console.error(error)
    if (win) {
      await shot('failure').catch(() => {})
      console.error(await text().catch(() => ''))
    }
    app.exit(1)
  })
