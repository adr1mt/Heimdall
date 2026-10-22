// Real preload, IPC, renderer and disk; native selection/confirmation use fixtures.
import { app, BrowserWindow, dialog } from 'electron'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { registerIpc } from '../src/main/ipc'
import { classesFile, readClasses, writeClasses } from '../src/main/classes'
import { readSourceCopy, sourceCopiesSlot, writeSourceFile } from '../src/main/source-backup'

const base = mkdtempSync(join(tmpdir(), 'heimdall-source-ui-'))
const profile = join(base, 'profile'), project = join(base, 'redes-demo')
for (const dir of [profile, project]) mkdirSync(dir)
const out = resolve('../docs/reviews/evidence/T200'); mkdirSync(out, { recursive: true })
const exam = join(project, 'examen.yaml')
const initialExam = 'examen: "Primera versión ficticia"\nversion: 1\nhosts: [host1]\ngrupos: []\n'
const currentExam = initialExam.replace('Primera', 'Segunda')
const group = { id: 'demo', name: 'Clase primera ficticia', columns: [], password: 'HEIMDALL_FICTIONAL_SOURCE_TEST', students: [] }
writeClasses(profile, [group])
writeClasses(profile, [{ ...group, name: 'Clase segunda ficticia' }])
writeSourceFile(profile, exam, 'exam', initialExam)
writeSourceFile(profile, exam, 'exam', currentExam)
writeFileSync(join(profile, 'settings.json'), JSON.stringify({ enginePath: resolve('../bin/heimdall') }))
app.setPath('userData', profile)
app.disableHardwareAcceleration()
let confirmed = false
let chosenCopy = ''
let openCount = 0
const copyOf = (source: string, kind: 'classes' | 'exam', content: string) => {
  const dir = sourceCopiesSlot(profile, source, kind)
  return readdirSync(dir).filter(name => name.endsWith('.json')).map(name => join(dir, name))
    .find(path => readSourceCopy(profile, path, kind).includes(content))!
}
dialog.showOpenDialog = (async (options: Electron.OpenDialogOptions) => {
  openCount++
  return { canceled: false, filePaths: [options.properties?.includes('openDirectory') ? project : chosenCopy] }
}) as never
dialog.showMessageBox = (async () => ({ response: confirmed ? 1 : 0, checkboxChecked: false })) as never

void app.whenReady().then(async () => {
  let win: BrowserWindow | undefined
  try {
    registerIpc()
    win = new BrowserWindow({ width: 1280, height: 820, show: true,
      webPreferences: { preload: resolve('out/preload/index.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
    const js = (source: string) => win!.webContents.executeJavaScript(source)
    const wait = async (predicate: string) => {
      for (let i = 0; i < 100; i++) {
        if (await js(predicate)) return
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      throw new Error(`UI condition not reached: ${predicate}`)
    }
    const click = (text: string) => js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`)
    await win.loadFile(resolve('out/renderer/index.html'))
    await wait(`document.body.innerText.includes('Clases')`)
    await click('Clases')
    await wait(`document.body.innerText.includes('Clase segunda ficticia')`)
    chosenCopy = copyOf(classesFile(profile), 'classes', 'Clase primera ficticia')
    const before = readFileSync(classesFile(profile), 'utf8')
    await click('Recuperar versión…')
    await new Promise(resolve => setTimeout(resolve, 150))
    assert.equal(readFileSync(classesFile(profile), 'utf8'), before, 'cancel must leave classes intact')
    confirmed = true
    await click('Recuperar versión…')
    await wait(`document.body.innerText.includes('Clase primera ficticia')`)
    assert.equal(readClasses(profile)[0].name, group.name)

    // A corrupt original still offers recovery; its exact text is kept.
    writeFileSync(classesFile(profile), '{corrupt-fictitious-original')
    win.webContents.reload()
    await wait(`document.body.innerText.includes('Clases')`)
    await click('Clases')
    await wait(`document.querySelector('[role="alert"]') !== null`)
    await click('Recuperar versión…')
    await wait(`document.body.innerText.includes('Clase primera ficticia')`)
    assert(copyOf(classesFile(profile), 'classes', '{corrupt-fictitious-original'))
    await click('Tema claro')
    await wait(`!document.documentElement.classList.contains('dark')`)
    await win.capturePage().then(image => writeFileSync(join(out, 'clases-1280.png'), image.toPNG()))

    await click('Inicio')
    await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Abrir…')`)
    await click('Abrir…')
    await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='El examen' && !b.disabled)`)
    await click('El examen')
    await wait(`document.body.innerText.includes('Segunda versión ficticia')`)
    chosenCopy = copyOf(exam, 'exam', 'Primera versión ficticia')
    await click('Recuperar versión…')
    await wait(`document.body.innerText.includes('Versión recuperada como borrador')`)
    assert.equal(readFileSync(exam, 'utf8'), currentExam, 'exam recovery must not write')
    const count = openCount
    assert.equal(await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Recuperar versión…').disabled`), true)
    await click('Recuperar versión…'); assert.equal(openCount, count)
    await click('Tema oscuro')
    await wait(`document.documentElement.classList.contains('dark')`)
    win.setSize(960, 720)
    await new Promise(resolve => setTimeout(resolve, 200))
    await win.capturePage().then(image => writeFileSync(join(out, 'examen-960-dark.png'), image.toPNG()))
    console.log('Source recovery UI OK: cancel, confirm, corrupt classes, exact original preserved, exam draft and dirty guard. Fictional data only.')
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    win?.destroy()
    app.exit(process.exitCode ?? 0)
  }
})
