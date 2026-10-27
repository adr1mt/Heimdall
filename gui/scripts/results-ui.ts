// Run from gui/ after build and bundling results-fixture.tsx with esbuild.
import { app, BrowserWindow } from 'electron'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const base = mkdtempSync(join(tmpdir(), 'heimdall-results-ui-'))
const out = resolve(process.env.RESULTS_UI_OUT || '/tmp/heimdall-results-ui')
const baseline = process.env.RESULTS_UI_BASELINE === '1'
mkdirSync(out, { recursive: true })
app.setPath('userData', join(base, 'profile'))
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('force-device-scale-factor', '1')
const css = readdirSync('out/renderer/assets').find((name) => name.startsWith('index-') && name.endsWith('.css'))!
writeFileSync(join(base, 'style.css'), readFileSync(join('out/renderer/assets', css)))
writeFileSync(join(base, 'fixture.js'), readFileSync('/tmp/heimdall-results-fixture.js'))
writeFileSync(join(base, 'index.html'), '<html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
const wait = () => new Promise((r) => setTimeout(r, 200))
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: process.env.RESULTS_UI_VISIBLE === '1',
    webPreferences: { contextIsolation: true, nodeIntegration: false, zoomFactor: 1,
      backgroundThrottling: false, offscreen: process.env.RESULTS_UI_VISIBLE !== '1' } })
  const errors: string[] = []
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error') { errors.push(event.message); console.error(event.message) }
  })
  await win.loadFile(join(base, 'index.html'))
  const js = (code: string) => win.webContents.executeJavaScript(code)
  const shot = async (name: string) => {
    // Give the compositor a full frame after resize/theme/scroll, not just React.
    await new Promise((r) => setTimeout(r, 600))
    const capture = await win.webContents.capturePage()
    const bitmap = capture.toBitmap()
    const expected = await js('getComputedStyle(document.body).backgroundColor.match(/\\d+/g).slice(0,3).map(Number)')
    assert.deepEqual([bitmap[2], bitmap[1], bitmap[0]], expected, `Composited theme: ${name}`)
    writeFileSync(join(out, `${name}.png`), capture.toPNG())
  }
  const click = async (label: string) => {
    await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing: '+${JSON.stringify(label)});b.click()})()`)
    await wait()
  }
  const headers = () => js("[...document.querySelectorAll('thead th[data-column]')].map(e=>e.dataset.column)")
  const choose = async (value: string) => {
    await js(`(()=>{const e=document.querySelector('select[aria-label="Ordenar alumnos"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await wait()
  }
  const labelled = async (label: string) => {
    await js(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)});if(!e)throw Error('Missing action: '+${JSON.stringify(label)});e.click()})()`)
    await wait()
  }
  const openHidden = async () => {
    await js(`(()=>{const e=[...document.querySelectorAll('summary')].find(e=>e.textContent.trim().startsWith('Ocultos ('));if(!e)throw Error('Missing hidden students');e.parentElement.open=true})()`)
    await wait()
  }
  const proof: unknown[] = []
  await wait()
  await click('Matriz')
  for (const count of baseline ? [5] : [5, 30]) {
    await js(`window.resultsFixture(${count})`)
    await wait()
    for (const [width, height] of baseline ? [[1440, 900]] : [[1440, 900], [1024, 768], [390, 844]]) {
      win.setSize(width, height)
      for (const theme of ['light', 'dark']) {
        await js(`document.documentElement.classList.toggle('dark', ${theme === 'dark'})`)
        await wait()
        await shot(`${count}-${width}-${theme}`)
        if (!baseline) {
          assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true, 'No page overflow')
          assert.equal(await js('document.querySelectorAll("thead tr").length'), 1, 'Single header row')
          const geometry = await js(`(()=>{
            const region=document.querySelector('[role="region"]');
            region.scrollLeft=800;region.scrollTop=500;
            return {horizontal:region.scrollWidth>region.clientWidth,vertical:region.scrollHeight>region.clientHeight};
          })()`)
          await wait()
          const sticky = await js(`(()=>{
            const region=document.querySelector('[role="region"]'),r=region.getBoundingClientRect();
            const corner=document.querySelector('thead th'),c=corner.getBoundingClientRect();
            const row=document.querySelectorAll('tbody th')[20].getBoundingClientRect();
            return {cornerX:Math.abs(c.left-r.left-1),cornerY:Math.abs(c.top-r.top-1),rowX:Math.abs(row.left-r.left-1),
              onTop:document.elementFromPoint(c.left+5,c.top+5)===corner};
          })()`)
          assert.equal(geometry.vertical, true)
          if (count === 30 || width === 390) assert.equal(geometry.horizontal, true)
          assert.ok(sticky.cornerX < 2 && sticky.cornerY < 2 && sticky.rowX < 2 && sticky.onTop, JSON.stringify(sticky))
          proof.push({ count, width, theme, geometry, sticky })
          if (count === 30) await shot(`${count}-${width}-${theme}-scroll`)
          await js(`(()=>{const r=document.querySelector('[role="region"]');r.scrollTop=0;r.scrollLeft=0})()`)
        }
      }
    }
  }
  if (!baseline) {
    win.setSize(1440, 900)
    await js('window.resultsFixture(5)'); await wait()
    assert.ok(await js('document.body.innerText.includes("5,06")'), 'Visible mean')
    await click('Aprobados')
    assert.deepEqual(await headers(), ['demo-0', 'demo-1'])
    await click('Lista')
    assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 2)
    await click('Matriz'); await click('Suspensos')
    assert.deepEqual(await headers(), ['demo-2', 'demo-3', 'demo-4'])
    await click('Todos'); await choose('grade-asc')
    assert.deepEqual(await headers(), ['demo-4', 'demo-3', 'demo-2', 'demo-1', 'demo-0'])
    await choose('grade-desc')
    assert.deepEqual(await headers(), ['demo-0', 'demo-1', 'demo-2', 'demo-3', 'demo-4'])
    await choose('failures')
    assert.deepEqual(await headers(), ['demo-4', 'demo-3', 'demo-2', 'demo-1', 'demo-0'])
    await click('Restablecer')
    await js(`document.querySelector('thead button').click()`); await wait()
    assert.ok(await js('document.body.innerText.includes("Ana Demo 1") && !document.querySelector("table thead")'), 'Student detail')
    await js(`document.querySelector('button').click()`); await wait()
    assert.equal((await headers()).length, 5, 'Return to matrix')
    await js('window.resultsFixture(5,true)'); await wait()
    await click('Sin evaluar')
    assert.deepEqual(await headers(), ['demo-4'])
    assert.ok(await js('document.querySelector("thead").innerText.includes("Sin evaluar")'))
    await shot('incomplete')
    await click('Restablecer')
    await js(`(()=>{document.querySelector('details:not(.relative)').open=true;const b=[...document.querySelectorAll('[aria-label="Filtrar comprobaciones"] button')].find(e=>e.textContent==='Mal');b.click()})()`)
    await wait()
    await click('Aprobados')
    assert.deepEqual(await headers(), ['demo-1'], 'Check and student filters intersect')
    proof.push({ interactions: 'pass/fail/ungraded, list/matrix, all four orders, detail/back, reset, combined filters: PASS' })

    await click('Restablecer')
    await js('window.resultsFixture(5)'); await wait()
    await labelled('Ocultar a Ana Demo 1')
    assert.equal((await headers()).length, 4, 'Hide matrix column')
    await click('Lista')
    assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 4)
    assert.equal(await js(`document.querySelectorAll('button button').length`), 0, 'Independent hide/detail buttons')
    await labelled('Ocultar a Carla Demo 3')
    await js('window.resultsRemount()'); await wait()
    assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 3, 'Survives remount/navigation')
    await click('Matriz')
    const visible = await headers()
    await js('window.resultsProjector(true)'); await wait()
    assert.deepEqual(await headers(), visible, 'Projector preserves hidden students')
    for (const order of ['name', 'grade-asc', 'grade-desc', 'failures']) {
      await choose(order)
      const projected = await headers()
      await js('window.resultsProjector(false)'); await wait()
      assert.deepEqual(await headers(), projected, `Same order outside projector: ${order}`)
      await js('window.resultsProjector(true)'); await wait()
    }
    await click('Restablecer')
    assert.equal((await headers()).length, 3, 'Reset does not restore hidden students')
    await openHidden()
    await labelled('Mostrar a Ana Demo 1')
    assert.equal((await headers()).length, 4, 'Restore one in projector')
    await openHidden(); await click('Mostrar todos')
    assert.equal((await headers()).length, 5)
    await js('window.resultsConnections()'); await wait()
    await click('Evaluados')
    assert.deepEqual(await headers(), ['demo-0', 'demo-1', 'demo-2'], 'Includes partial and timeout after SSH; excludes failed auth and connect')
    await js('window.resultsProjector(true)'); await wait()
    assert.deepEqual(await headers(), ['demo-0', 'demo-1', 'demo-2'])
    await choose('grade-asc')
    assert.deepEqual(await headers(), ['demo-0', 'demo-1', 'demo-2'], 'Missing final grades remain last')
    await shot('projector-evaluated')
    await click('Lista')
    assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 3)
    await labelled('Ver detalle: Ana Demo 1')
    assert.equal(await js(`document.body.innerText.includes('192.0.2.10') || document.body.innerText.includes('servidor.aula')`), false, 'Machine details masked')
    await click('Volver')
    win.setSize(1024, 768)
    await shot('projector-list')
    assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true, 'List hide controls fit')
    await labelled('Ocultar a Ana Demo 1')
    await labelled('Ocultar a Bruno Demo con un nombre y dos apellidos muy largos')
    await labelled('Ocultar a Carla Demo 3')
    assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 0)
    await click('Restablecer')
    assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 2, 'Only disconnected students remain after reset')
    await labelled('Ocultar a Diego Demo 4')
    await labelled('Ocultar a Elena Demo 5')
    assert.ok(await js(`document.body.innerText.includes('Todos los alumnos están ocultos')`))
    await openHidden()
    win.setSize(1024, 768)
    await js(`document.documentElement.classList.add('dark')`); await wait()
    await shot('projector-all-hidden')
    assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true, 'Projector controls fit')
    await click('Mostrar todos')
    assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 5)
    await labelled('Ocultar a Ana Demo 1')
    await js('window.resultsFixture(5)'); await wait()
    assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 4, 'New correction preserves hiding')
    await js('window.resultsRemount()'); await wait()
    assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ver detalle:"]').length`), 4)
    proof.push({ sessionControls: 'hide/list/matrix/remount/new run, restore one/all/empty, evaluated SSH/partial/timeout, all projector orders, masked detail: PASS' })
    writeFileSync(join(out, 'proof.json'), JSON.stringify(proof, null, 2))
  }
  assert.deepEqual(errors, [], 'Renderer errors')
  console.log(`Results captures: ${out}`)
  app.exit(0)
}).catch((error) => { console.error(error); app.exit(1) })
