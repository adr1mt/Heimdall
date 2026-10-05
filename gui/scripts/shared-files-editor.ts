// T174: exercise file-source editing in the built Electron renderer.
import { app, BrowserWindow, dialog } from 'electron'
import { join, resolve } from 'node:path'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { registerIpc } from '../src/main/ipc'
import { writeSettings } from '../src/main/store'
import { writeLabClass } from './lab-flow'

const root = process.cwd()
const work = mkdtempSync(join(tmpdir(), 'heimdall-file-editor-'))
const project = join(work, 'examen')
const out = resolve(process.env.FILE_EDITOR_OUT || '/tmp/heimdall-file-editor-shots')
const wait = (ms = 150): Promise<void> => new Promise(r => setTimeout(r, ms))
app.setPath('userData', join(work, 'profile'))
app.on('window-all-closed', () => {})
dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [project] })) as never

app.whenReady().then(async () => {
  mkdirSync(project, { recursive: true })
  mkdirSync(out, { recursive: true })
  const fixture = 'examen: P\nversion: 1\nhosts: [host1]\ngrupos:\n- grupo: Kea\n  comprobaciones:\n  - id: kea\n    descripcion: Contiene Dhcp4\n    en: host1\n    fichero: "/etc/kea/kea-dhcp4.conf"\n    contiene: "Dhcp4"\n'
  writeFileSync(join(project, 'examen.yaml'), fixture)
  writeSettings(app.getPath('userData'), { enginePath: resolve(root, '../bin/heimdall') })
  const classId = writeLabClass(app.getPath('userData'))
  registerIpc()
  const win = new BrowserWindow({ width: 1280, height: 900, show: true,
    webPreferences: { preload: join(root, 'out/preload/index.cjs'), sandbox: false, contextIsolation: true, nodeIntegration: false } })
  const js = (code: string): Promise<unknown> => win.webContents.executeJavaScript(code)
  const click = async (label: string): Promise<void> => {
    const found = await js(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}); if(b) b.click();return !!b })()`)
    if (!found) throw new Error(`Missing button: ${label}`)
    await wait()
  }
  const input = async (label: string, value: string): Promise<void> => {
    const found = await js(`(() => {const el=[...document.querySelectorAll('label input')].find(e=>e.closest('label').textContent.includes(${JSON.stringify(label)}));if(!el)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
    if (!found) throw new Error(`Missing input: ${label}`)
    await wait()
  }
  const assert = (ok: unknown, detail: string): void => { if (!ok) throw new Error(detail); console.log(`OK ${detail}`) }
  await win.loadFile(join(root, 'out/renderer/index.html'))
  await wait(650)
  await js(`[...document.querySelectorAll('header button')].find(b=>b.textContent.includes('Abrir')).click()`)
  await wait(600)
  await js(`(() => {const s=document.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(classId)});s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await wait(300)
  await click('El examen')
  await click('Editar')
  assert(await js(`document.querySelector('input[name="check-source"]:checked').closest('label').textContent.includes('Fichero')`), 'file source selected on reopen')
  assert(await js(`document.querySelector('option[value="exit_code"]').disabled`), 'exit_code unavailable for a file')
  for (const width of [1280, 960]) {
    win.setSize(width, 900)
    for (const dark of [true, false]) {
      await js(`document.documentElement.classList.toggle('dark',${dark})`)
      await wait(180)
      assert(await js(`document.documentElement.scrollWidth<=window.innerWidth`), `no horizontal overflow at ${width}`)
      writeFileSync(join(out, `${width}-${dark ? 'dark' : 'light'}.png`), (await win.webContents.capturePage()).toPNG())
    }
  }
  await input('Ruta del fichero', '')
  assert(await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar').disabled`), 'empty path blocks saving')
  await input('Ruta del fichero', '/etc/kea/kea-dhcp4.conf')
  // Exercise all three radio choices and return to the shared file source.
  for (const label of ['Comando en una máquina', 'Valor del inventario del alumno', 'Fichero de una máquina']) {
    assert(await js(`(() => {const el=[...document.querySelectorAll('input[name="check-source"]')].find(e=>e.closest('label').textContent.trim()===${JSON.stringify(label)});if(el)el.click();return !!el})()`), `source choice: ${label}`)
    await wait()
  }
  await input('Ruta del fichero', '/etc/kea/kea-dhcp4.conf')
  await click('Guardar')
  await click('Guardar el examen')
  await wait(600)
  const saved = readFileSync(join(project, 'examen.yaml'), 'utf8')
  assert(saved.includes('fichero:') && !/^\s+(cmd|valor):/m.test(saved), 'disk save preserves the file source')
  await click('Editar')
  assert(await js(`document.querySelector('input[name="check-source"]:checked').closest('label').textContent.includes('Fichero')`), 'form reopening preserves the file source')
  console.log(`Screenshots: ${out}`)
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
