// T185: per-student reports from a real SSH correction. Real IPC, preload,
// renderer and engine; only the native folder dialog is stubbed. Writes the
// screenshots and one PDF to docs/reviews/evidence/T185. Run from gui/ after
// build, with the lab up (make lab).
import { app, BrowserWindow, dialog } from 'electron'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { registerIpc } from '../src/main/ipc'

const SECRET = process.env.LAB_SECRET || 'HEIMDALL_SECRET_TEST_12345'
const base = mkdtempSync(join(tmpdir(), 'heimdall-report-'))
const project = join(base, 'redes-demo')
const profile = join(base, 'profile')
const target = join(base, 'entrega')
const out = resolve('../docs/reviews/evidence/T185')
for (const dir of [project, profile, target]) mkdirSync(dir)
mkdirSync(out, { recursive: true })

const names = ['Ana Demo', 'Bruno Demo', 'Carla Demo', 'Diego Demo']
const expected = ['443', '22', '53', 'dhcp', 'dns']
const labels = [
  'El servicio web escucha en el puerto de HTTPS',
  'El acceso remoto usa el puerto de SSH',
  'El servidor de nombres escucha en el puerto 53',
  'La red reparte direcciones IP de forma automática',
  'Los nombres de las máquinas se resuelven'
]
// What a machine answers when the student got it wrong: it must never reach a report.
const WRONG = 'SALIDA-DE-MAQUINA-INCORRECTA'
const students = names.map((name, index) => ({
  id: `alu${index + 1}`,
  name,
  contact: `alu${index + 1}@example.invalid`,
  host: '127.1.2.3',
  // Diego's machine is off: his checks cannot be looked at.
  port: index === 3 ? '2299' : '2201',
  user: 'alumno',
  fields: Object.fromEntries(expected.map((value, i) => [`p${i + 1}`, i < 5 - index * 2 ? value : WRONG]))
}))
writeFileSync(
  join(profile, 'classes.json'),
  JSON.stringify({
    classes: [{ id: 'demo', name: 'Clase demo', columns: ['p1', 'p2', 'p3', 'p4', 'p5'], password: SECRET, students }]
  })
)
writeFileSync(
  join(profile, 'settings.json'),
  JSON.stringify({ enginePath: resolve(process.env.HEIMDALL_ENGINE || '../bin/heimdall') })
)
const check = (i: number) =>
  `      - id: p${i + 1}\n        descripcion: ${labels[i]}\n        en: host1\n        cmd: ["echo", "\u0024{alumno.p${i + 1}}"]\n        igual_a: "${expected[i]}"\n`
writeFileSync(
  join(project, 'examen.yaml'),
  'examen: "Práctica 3 · Servicios de red"\nversion: 1\nhosts: [host1]\npor_defecto: { peso: 1, timeout: 10s }\ngrupos:\n' +
    '  - grupo: Puertos de servicio\n    comprobaciones:\n' + [0, 1, 2].map(check).join('') +
    '  - grupo: DHCP y DNS\n    comprobaciones:\n' + [3, 4].map(check).join('')
)

app.setPath('userData', profile)
app.disableHardwareAcceleration()
let picks = 0
dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [picks++ === 0 ? project : target] })) as never

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
let win: BrowserWindow
const js = (code: string): Promise<any> => win.webContents.executeJavaScript(code)
const text = () => js('document.body.innerText') as Promise<string>
async function until(code: string, label: string, timeout = 40000) {
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
async function shot(w: BrowserWindow, name: string) {
  await delay(500)
  writeFileSync(join(out, `${name}.png`), (await w.webContents.capturePage()).toPNG())
}

app
  .whenReady()
  .then(async () => {
    registerIpc()
    win = new BrowserWindow({
      width: 1280,
      height: 860,
      autoHideMenuBar: true,
      webPreferences: { preload: resolve('out/preload/index.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false }
    })
    const consoleErrors: string[] = []
    win.webContents.on('console-message', (_e, level, message) => {
      if (level >= 2) consoleErrors.push(message)
    })
    await win.loadFile(resolve('out/renderer/index.html'))
    await until("!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Abrir…')", 'home')
    await click('Abrir…')
    await until("!!document.querySelector('select')", 'class chooser')
    await js(
      `(()=>{const e=document.querySelector('select[aria-label]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'demo');e.dispatchEvent(new Event('change',{bubbles:true}));})()`
    )
    await delay(400)
    await click('Corregir', 'header button')
    await until("document.querySelector('header h1')?.textContent === 'Resultados'", 'results')
    await click('Informes por alumno…')
    await shot(win, '01-confirmacion')
    assert.match(await text(), /3 informes, uno por alumno|4 informes, uno por alumno/)
    await click('Elegir carpeta y guardar')
    await until("document.body.innerText.includes('Informes guardados en')", 'reports saved')
    await shot(win, '02-guardado')

    const [folder] = readdirSync(target)
    assert.match(folder, /^informes-practica-3-servicios-de-red-\d{8}-\d{6}$/)
    const files = readdirSync(join(target, folder)).sort()
    assert.deepEqual(files, ['ana-demo.html', 'bruno-demo.html', 'carla-demo.html', 'diego-demo.html'])
    for (const [i, file] of files.entries()) {
      const html = readFileSync(join(target, folder, file), 'utf8')
      assert.ok(!html.includes(SECRET), `${file}: password`)
      assert.ok(!html.includes(WRONG), `${file}: machine output`)
      assert.ok(!html.includes('echo'), `${file}: command`)
      assert.ok(!html.includes('127.1.2.3'), `${file}: address`)
      assert.ok(!/<script|https?:\/\//.test(html), `${file}: not self-contained`)
      for (const [j, other] of names.entries()) assert.equal(html.includes(other), i === j, `${file}: ${other}`)
      assert.match(html, /Práctica 3 · Servicios de red/)
    }
    const diego = readFileSync(join(target, folder, 'diego-demo.html'), 'utf8')
    assert.match(diego, /Sin nota final/)
    assert.doesNotMatch(diego, /class="check fail"/)

    const viewer = new BrowserWindow({ width: 900, height: 1200, show: true, webPreferences: { javascript: false } })
    for (const file of files) {
      await viewer.loadFile(join(target, folder, file))
      await shot(viewer, `03-informe-${file.replace('.html', '')}`)
    }
    await viewer.loadFile(join(target, folder, 'carla-demo.html'))
    writeFileSync(join(out, '04-carla-demo.pdf'), await viewer.webContents.printToPDF({ pageSize: 'A4', printBackground: true }))
    viewer.setSize(390, 1400)
    await shot(viewer, '05-informe-movil')

    assert.deepEqual(consoleErrors, [])
    const result = { ok: true, base, folder, files, consoleErrors }
    writeFileSync(join(out, 'verification.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
    app.quit()
  })
  .catch(async (error) => {
    console.error(error)
    if (win) console.error(await text().catch(() => ''))
    app.exit(1)
  })
