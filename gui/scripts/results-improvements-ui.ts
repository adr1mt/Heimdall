// Isolated Electron assertions for classroom refresh, zoom and report actions.
import { app, BrowserWindow } from 'electron'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
const base = mkdtempSync(join(tmpdir(), 'heimdall-improvements-'))
const out = resolve(process.env.RESULTS_UI_OUT || '/tmp/heimdall-improvements-ui')
mkdirSync(out, { recursive: true })
app.setPath('userData', join(base, 'profile'))
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('force-device-scale-factor', '1')
const css = readdirSync('out/renderer/assets').find((name) => name.startsWith('index-') && name.endsWith('.css'))!
writeFileSync(join(base, 'style.css'), readFileSync(join('out/renderer/assets', css)))
writeFileSync(join(base, 'fixture.js'), readFileSync('/tmp/heimdall-results-fixture.js'))
writeFileSync(join(base, 'index.html'), '<html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
const wait = () => new Promise((r) => setTimeout(r, 250))
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, offscreen: true, backgroundThrottling: false } })
  const errors: string[] = []
  win.webContents.on('console-message', (event) => { if (event.level === 'error') { errors.push(event.message); console.error(event.message) } })
  await win.loadFile(join(base, 'index.html'))
  const js = async (code: string) => { try { return await win.webContents.executeJavaScript(code) } catch (error) { console.error(code); throw error } }
  const click = async (label: string, aria = false) => {
    await js(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>${aria ? 'e.getAttribute("aria-label")' : 'e.textContent.trim()'}===${JSON.stringify(label)});if(!b || b.disabled) throw Error('Missing/disabled: '+${JSON.stringify(label)});b.click()})()`)
    await wait()
  }
  const shot = async (name: string) => { await wait(); writeFileSync(join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()) }
  const proof: unknown[] = []
  await wait()
  await click('Enviar informe a Ana Demo 1', true)
  assert.ok(await js(`document.querySelector('[role="alertdialog"]').textContent.includes('Destinatario: Ana Demo 1 (demo-0)')`))
  await click('Enviar')
  assert.deepEqual(await js('window.resultsDeliveryCalls'), [['demo-0']], 'Single report only')
  await click('Cerrar')
  assert.ok(await js(`document.querySelector('[aria-label="Informe enviado a Ana Demo 1"]').disabled`))
  await js('window.resultsRemount()'); await wait()
  assert.ok(await js(`document.querySelector('[aria-label="Informe enviado a Ana Demo 1"]').disabled`), 'Receipt survives navigation')
  await click('Enviar informes…')
  assert.ok(await js(`document.querySelector('[role="alertdialog"]').textContent.includes('1 ya enviados')`))
  await click('Enviar')
  assert.equal(await js('window.resultsDeliveryCalls[1].length'), 5, 'Bulk still sends entire class after confirmation')
  await js(`document.querySelector('[role="alertdialog"] summary').click()`); await wait()
  await shot('desktop-report-help')
  await click('Cerrar')
  await js(`window.resultsRefresh('begin')`); await wait()
  assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 5, 'Old grades stay during refresh')
  assert.ok(await js(`document.body.innerText.includes('Corrigiendo…')`))
  await shot('refresh-preserves-results')
  await js(`window.resultsRefresh('fail')`); await wait()
  assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 5)
  assert.ok(await js(`document.body.innerText.includes('Se conservan los resultados anteriores') && document.body.innerText.includes('Próxima corrección en')`))
  await js(`window.resultsRefresh('success')`); await wait()
  assert.ok(await js(`!document.body.innerText.includes('Se conservan los resultados anteriores')`))
  proof.push({ delivery: 'single recipient, named confirmation, persistent row state, explicit bulk resend and Desktop help PASS', refresh: 'grades retained on begin/failure, countdown and replacement PASS' })
  for (const count of [5, 30]) {
    await js(`window.resultsFixture(${count}); window.resultsProjector(true)`); await wait()
    await click('Matriz')
    for (const [width, height] of [[1440, 900], [1024, 768]]) {
      win.setSize(width, height); await wait()
      const active = await js(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Ajustar a pantalla');return b.getAttribute('aria-pressed')==='true'})()`)
      if (!active) await click('Ajustar a pantalla')
      await wait()
      const geometry = await js(`(()=>{
        const content=document.querySelector('.projector-content'), viewport=content.parentElement, table=document.querySelector('table');
        const v=viewport.getBoundingClientRect(),t=table.getBoundingClientRect();
        return { count:document.querySelectorAll('thead th[data-column]').length, checks:document.querySelectorAll('tbody tr').length,
          viewport:{width:v.width,height:v.height},table:{right:t.right,bottom:t.bottom},
          fits:t.right<=v.right+2 && t.bottom<=v.bottom+2, horizontal:viewport.scrollWidth-viewport.clientWidth,vertical:viewport.scrollHeight-viewport.clientHeight,
          font:getComputedStyle(document.querySelector('.case-name')).fontSize,zoom:document.querySelector('output').textContent };
      })()`)
      assert.equal(geometry.count, count)
      assert.equal(geometry.checks, 50)
      assert.ok(geometry.fits, JSON.stringify(geometry))
      assert.ok(geometry.horizontal <= 2 && geometry.vertical <= 2, JSON.stringify(geometry))
      await shot(`fit-${count}-${width}`)
      proof.push({ count, width, geometry })
    }
    await click('Suspensos')
    assert.equal(await js(`document.querySelectorAll('thead th[data-column]').length`), count * 3 / 5)
    assert.ok(await js(`(()=>{const c=document.querySelector('.projector-content'),v=c.parentElement;return v.scrollHeight<=v.clientHeight+2})()`), 'Fit recalculates after filtering')
    await click('Todos')
    await click('Ocultar a Ana Demo 1', true)
    assert.equal(await js(`document.querySelectorAll('thead th[data-column]').length`), count - 1)
    await js(`(()=>{const s=[...document.querySelectorAll('summary')].find(e=>e.textContent.startsWith('Ocultos ('));s.parentElement.open=true})()`)
    await click('Mostrar todos')
    assert.equal(await js(`document.querySelectorAll('thead th[data-column]').length`), count)
    assert.equal(await js(`getComputedStyle(document.querySelector('.case-name')).webkitLineClamp`), '2', 'Long case descriptions allow two lines')
    await click('Aumentar zoom', true)
    assert.ok(await js(`!document.querySelector('.projector-fit')`), 'Manual zoom leaves automatic fit')
    await click('Reducir zoom', true)
    await click('Lista')
    await click('Ajustar a pantalla')
    await shot(`fit-list-${count}`)
    assert.ok(await js(`(()=>{const c=document.querySelector('.projector-content'),v=c.parentElement;return v.scrollHeight<=v.clientHeight+2})()`), 'All list students fit')
  }
  assert.deepEqual(errors, [], 'No renderer errors')
  writeFileSync(join(out, 'proof.json'), JSON.stringify(proof, null, 2))
  console.log(`Improvement evidence: ${out}`)
  app.exit(0)
}).catch((error) => { console.error(error); app.exit(1) })
