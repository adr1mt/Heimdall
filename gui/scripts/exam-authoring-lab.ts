// Real engine, preload, IPC, renderer and disk. Fictional exam; no class or SSH.
import { app, BrowserWindow, dialog } from 'electron'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { registerIpc } from '../src/main/ipc'
import { readSourceCopy, sourceCopiesSlot } from '../src/main/source-backup'

const base = mkdtempSync(join(tmpdir(), 'heimdall-authoring-'))
const profile = join(base, 'profile'), project = join(base, 'project')
for (const path of [profile, project]) mkdirSync(path)
const out = resolve('../docs/reviews/evidence/T203')
mkdirSync(out, { recursive: true })
const examPath = join(project, 'examen.yaml')
const yaml = '# Comentario ficticio: conservar exactamente.\nexamen: "Examen original"\nversion: 1\nhosts: [host1]\npor_defecto: {peso: 1, sudo: true}\ngrupos:\n  - grupo: Red\n    comprobaciones:\n      - id: dominio\n        en: host1\n        cmd: ["echo", "${alumno.subdominio}"]\n        igual_a: "${host1.usuario}"\n'
writeFileSync(examPath, yaml)
writeFileSync(join(profile, 'settings.json'), JSON.stringify({ enginePath: resolve('../bin/heimdall') }))
app.setPath('userData', profile)
app.disableHardwareAcceleration()
dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [project] })) as never

void app.whenReady().then(async () => {
  let win: BrowserWindow | undefined
  try {
    registerIpc()
    win = new BrowserWindow({ width: 1280, height: 820, show: true,
      webPreferences: { preload: resolve('out/preload/index.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
    const js = (code: string) => win!.webContents.executeJavaScript(code)
    const pause = () => new Promise(resolve => setTimeout(resolve, 100))
    const wait = async (predicate: string) => {
      for (let i = 0; i < 200; i++) { if (await js(predicate)) return; await pause() }
      throw new Error(`UI condition not reached: ${predicate}\n${await js('document.body.innerText')}`)
    }
    const click = async (label: string) => {
      await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Unavailable: '+${JSON.stringify(label)});b.click()})()`)
    }
    const typeYaml = async (text: string) => {
      win!.focus(); win!.webContents.focus()
      const point = await js(`(()=>{const r=document.querySelector('.monaco-editor').getBoundingClientRect();return {x:Math.round(r.x+80),y:Math.round(r.y+10)}})()`)
      for (const type of ['mouseDown', 'mouseUp'] as const) win!.webContents.sendInputEvent({ type, ...point, button: 'left', clickCount: 1 })
      await pause()
      for (const type of ['keyDown', 'keyUp'] as const) win!.webContents.sendInputEvent({ type, keyCode: 'a', modifiers: ['control'] })
      await js(`(()=>{const d=new DataTransfer();d.setData('text/plain',${JSON.stringify(text)});document.querySelector('.monaco-editor textarea').dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));})()`)
      await wait(`document.body.innerText.includes('Sin guardar')`)
    }
    const saved = () => wait(`document.querySelector('[role=status]')?.innerText.includes('Examen guardado.')`)
    await win.loadFile(resolve('out/renderer/index.html'))
    await wait(`!!document.body && [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Abrir…')`)
    assert.deepEqual(await js('window.heimdall.listClasses()'), [])
    await click('Abrir…')
    await wait(`[...document.querySelectorAll('aside button')].some(b=>b.textContent.trim()==='El examen'&&!b.disabled)`)
    await click('El examen')
    await wait(`!!document.querySelector('.monaco-editor textarea')`)
    await click('Validar')
    await wait(`document.querySelector('[role=status]')?.innerText.includes('Examen válido.')`)
    assert.equal(readFileSync(examPath, 'utf8'), yaml, 'validation must not write')
    const renamed = yaml.replace('Examen original', 'Nombre nuevo sin clase')
    await typeYaml(renamed)
    await click('Guardar')
    await saved()
    assert.equal(readFileSync(examPath, 'utf8'), renamed)
    const slot = sourceCopiesSlot(profile, examPath, 'exam')
    const copies = readdirSync(slot).filter(name=>name.endsWith('.json')).map(name=>readSourceCopy(profile,join(slot,name),'exam'))
    assert(copies.includes(yaml) && copies.includes(renamed), 'both source versions retained')
    await win.capturePage().then(image=>writeFileSync(join(out,'guardado-sin-clase.png'),image.toPNG()))
    // Structural errors are visible and must not replace the saved exam.
    await typeYaml(renamed.replace('peso: 1', 'peso: -1'))
    await click('Guardar')
    await wait(`document.querySelector('[role=status]')?.innerText.includes('peso negativo')`)
    assert.equal(readFileSync(examPath, 'utf8'), renamed)
    await win.capturePage().then(image=>writeFileSync(join(out,'error-sin-clase.png'),image.toPNG()))
    // Ctrl+S follows the same class-independent save path.
    const final = renamed + '\n# Guardado con Ctrl+S.\n'
    await typeYaml(final)
    for (const type of ['keyDown','keyUp'] as const) win.webContents.sendInputEvent({type,keyCode:'s',modifiers:['control']})
    await saved()
    assert.equal(readFileSync(examPath,'utf8'),final)
    // Corrupt class persistence cannot prevent authoring, either.
    writeFileSync(join(profile,'classes.json'),'[corrupt-fictional')
    await click('Inicio')
    await wait(`document.body.innerText.includes('Nombre nuevo sin clase')`)
    await win.capturePage().then(image=>writeFileSync(join(out,'inicio-renombrado.png'),image.toPNG()))
    await click('Abrir…')
    await wait(`document.querySelector('h1')?.textContent === 'Corregir'`)
    await click('El examen')
    await wait(`!!document.querySelector('.monaco-editor textarea')`)
    await click('Validar')
    await wait(`document.querySelector('[role=status]')?.innerText.includes('Examen válido.')`)
    assert.equal(await js(`document.querySelector('h1')?.textContent`),'El examen: Nombre nuevo sin clase')
    assert.equal(await js('window.heimdall.readExam('+JSON.stringify(examPath)+')'),final)
    console.log('T203 OK: no classes; real engine validation; rename/save/reopen; Ctrl+S; exact comments; retained versions; invalid draft preserved; corrupt classes ignored. Fictional data only.')
  } catch (error) { console.error(error); process.exitCode = 1 }
  finally { win?.destroy(); app.exit(process.exitCode ?? 0) }
})
