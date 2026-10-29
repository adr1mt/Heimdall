// Run from gui/ after build and bundling classroom-fixture.tsx. Uses a temporary profile.
import { app, BrowserWindow } from 'electron'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
const base = mkdtempSync(join(tmpdir(), 'heimdall-density-'))
const out = resolve(process.env.DENSITY_UI_OUT || '/tmp/heimdall-classroom-ui')
mkdirSync(out, { recursive: true })
app.setPath('userData', join(base, 'profile'))
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('force-device-scale-factor', '1')
const css = readdirSync('out/renderer/assets').find((name) => name.startsWith('index-') && name.endsWith('.css'))!
writeFileSync(join(base, 'style.css'), readFileSync(join('out/renderer/assets', css)))
writeFileSync(join(base, 'fixture.js'), readFileSync('/tmp/heimdall-classroom-fixture.js'))
writeFileSync(join(base, 'index.html'), '<html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
const wait = () => new Promise((r) => setTimeout(r, 300))
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1366, height: 768, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, offscreen: true, backgroundThrottling: false } })
  const errors: string[] = []
  win.webContents.on('console-message', (event) => { if (event.level === 'error') { errors.push(event.message); console.error(event.message) } })
  const js = async (code: string) => { try { return await win.webContents.executeJavaScript(code) } catch (error) { console.error(code); throw error } }
  const click = async (name: string, aria = false) => {
    await js(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>${aria ? "e.getAttribute('aria-label')" : 'e.textContent.trim()'}===${JSON.stringify(name)});if(!b || b.disabled) throw Error('Missing button '+${JSON.stringify(name)});b.click()})()`)
    await wait()
  }
  const select = async (name: string, value: string) => {
    await js(`(()=>{const s=document.querySelector('select[aria-label="${name}"]');if(!s) throw Error('Missing select');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await wait()
  }
  const shot = async (name: string) => { await wait(); writeFileSync(join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()) }

  await win.loadFile(join(base, 'index.html')); await wait()
  assert.equal(await js(`document.querySelector('.teacher-display')`), null)
  await js(`window.densityCorrect()`); await wait()
  await js(`document.querySelector('.pending-student input').click()`); await wait()
  assert.equal(await js(`document.querySelectorAll('.pending-student input:not(:checked)').length`), 1)
  await shot('correct-hidden')
  await js(`window.densityResults()`); await wait()
  await click('Lista')
  assert.equal(await js(`document.querySelectorAll('.student-name').length`), 13)
  assert.equal(await js(`document.querySelectorAll('.student-row button[aria-label^="Enviar informe"]').length`), 0)
  await click('Matriz')
  assert.equal(await js(`document.querySelectorAll('thead th[data-column]').length`), 13)
  assert.ok(await js(`![...document.querySelectorAll('.results-body span')].some(s=>s.textContent.trim()==='superada' || s.textContent.trim()==='fallada')`))
  await js(`document.querySelector('.results-options').open=true`); await wait()
  await select('Escala de interfaz', '90')
  assert.equal(await js(`getComputedStyle(document.documentElement).fontSize`), '14.4px')
  await select('Escala de interfaz', '100')
  await js(`document.querySelector('.results-options').open=false`)
  await shot('matrix-hidden')
  await js(`window.resultsProjector(true)`); await wait()
  await click('Ajustar a pantalla', true)
  await shot('projector')
  await js(`window.resultsProjector(false);window.classroomFinal()`); await wait()
  assert.ok(await js(`document.querySelector('[data-testid="final-grades"]')!==null`))
  assert.ok(await js(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Enviar informes a todos'))`))
  await shot('final-grades')
  await click('Preparar otro examen')
  assert.ok(await js(`document.querySelector('.correct-view')!==null`))
  assert.equal(await js(`document.querySelector('.class-selector select').value`), '')
  const selector = await js(`document.querySelector('.class-selector select').getAttribute('aria-label')`)
  await select(selector, 'demo')
  assert.ok(await js(`document.querySelector('.correct-view')!==null`), 'Selecting the same class must not restore old finals')
  assert.ok(await js(`!document.querySelector('[data-testid="final-grades"]')`))
  assert.equal(await js(`document.querySelectorAll('.pending-student input:checked').length`), 14)
  await shot('prepared-same-class')
  assert.deepEqual(errors, [], 'No renderer errors')
  writeFileSync(join(out, 'proof.json'), JSON.stringify({ hiddenAcrossViews: true, noIndividualReports: true,
    noSidebarDisplay: true, resultScale: true, projector: true, finalReports: true, prepareSameClass: true, rendererErrors: errors }, null, 2))
  console.log(`Classroom evidence: ${out}`)
  app.exit(0)
}).catch((error) => { console.error(error); app.exit(1) })
