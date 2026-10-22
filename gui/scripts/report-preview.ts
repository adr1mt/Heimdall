// Synthetic, offline report evidence. No IPC, SSH or delivery is involved.
// From gui/: node_modules/.bin/esbuild scripts/report-preview.ts --bundle
// --platform=node --format=esm --external:electron --outfile=/tmp/heimdall-report-preview.mjs
// node_modules/electron/dist/electron /tmp/heimdall-report-preview.mjs --no-sandbox
import { app, BrowserWindow } from 'electron'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { studentReport } from '../src/renderer/src/lib/report'
import { scaleOf } from '../src/renderer/src/lib/scale'
import { validRun } from '../tests/fixtures/valid-run'
import type { CheckResult, StudentResult } from '../src/shared/artifact'

const out = resolve('../docs/reviews/evidence/T193')
mkdirSync(out, { recursive: true })
app.setPath('userData', '/tmp/heimdall-report-preview-profile')
app.disableHardwareAcceleration()
const base = validRun()
const descriptions = [
  'El servicio web escucha en el puerto de HTTPS',
  'El acceso remoto usa el puerto de SSH',
  'El servidor de nombres escucha en el puerto 53',
  'La red reparte direcciones IP de forma automática',
  'Los nombres de las máquinas se resuelven',
  'El servicio de red está activo'
]
function checks(count: number, allPass = false): CheckResult[] {
  return Array.from({ length: count }, (_, i) => ({
    ...base.students[0].checks[0],
    check_id: `c${i + 1}`,
    group: count < 10 ? (i < 3 ? 'Puertos de servicio' : 'DHCP y DNS') :
      i < 35 ? 'Bloque extenso · Servicios de red' : `Bloque ${2 + Math.floor((i - 35) / 8)} · Configuración de servicios`,
    description: `${descriptions[i % descriptions.length]}${count > 10 ? ` (comprobación ${i + 1})` : ''}`,
    status: allPass || i % 3 === 0 ? 'PASS' : i % 3 === 1 ? 'FAIL' : 'UNEVALUATED',
    cause: !allPass && i % 3 === 2 ? 'CONNECT_FAILED' : 'NONE',
    weight: i === 0 ? 3 : 1,
    detail: 'INTERNAL-DO-NOT-PUBLISH', execution: null, assertion: null
  }))
}
function pupil(rows: CheckResult[], name = 'Alex Ejemplo · Alumno ficticio'): StudentResult {
  const total = rows.reduce((n, c) => n + c.weight, 0)
  const obtained = rows.filter(c => c.status === 'PASS').reduce((n, c) => n + c.weight, 0)
  const pending = rows.filter(c => c.status === 'UNEVALUATED').reduce((n, c) => n + c.weight, 0)
  const evaluable = total - pending
  const status = !evaluable ? 'NOT_EVALUATED' : pending ? 'PARTIAL' : 'OK'
  return { ...base.students[0], student_id: 'demo', name, status, checks: rows,
    score: { total, obtained, evaluable, unevaluated: pending,
      provisional_score: evaluable ? Math.round(100 * obtained / evaluable) : null,
      final_score: pending || !total ? null : Math.round(100 * obtained / total),
      status: !evaluable ? 'NOT_EVALUATED' : pending ? 'INCOMPLETE' : 'COMPLETE' }
  }
}
const longRows = checks(75)
longRows[40].group += ' · ' + 'NombreDeBloqueSinEspacios'.repeat(12)
longRows[41].description += ' · ' + 'DescripciónSinEspacios'.repeat(35)
const extreme = checks(3)
extreme[1].description = 'INICIO-EXTREMO ' + 'Descripción extensa de una comprobación del examen. '.repeat(280) + ' FIN-EXTREMO'
const examples = [
  { id: 'corto', student: pupil(checks(6).map(c => c.status === 'UNEVALUATED' ? { ...c, status: 'PASS' as const, cause: 'NONE' as const } : c)), scale: scaleOf('ten'), title: 'Práctica 3 · Servicios de red' },
  { id: 'mixto', student: pupil(checks(6)), scale: scaleOf('ten'), title: 'Práctica 3 · Servicios de red' },
  { id: 'correcto', student: pupil(checks(6, true)), scale: scaleOf('hundred'), title: 'Práctica 3 · Servicios de red' },
  { id: 'largo', student: pupil(longRows, 'Alex ' + 'ApellidosDeEjemploSinEspacios'.repeat(10)), scale: scaleOf('hundred', 80), title: 'Práctica de servicios, redes y seguridad · ' + 'TítuloLargo'.repeat(12) },
  { id: 'extremo', student: pupil(extreme), scale: scaleOf('ten'), title: 'Prueba de descripción más larga que una página' },
  { id: 'vacio', student: pupil([]), scale: scaleOf('ten'), title: 'Sin comprobaciones' }
]

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 980, height: 1100, show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  const network: string[] = []
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    if (!details.url.startsWith('file:')) network.push(details.url)
    callback({ cancel: !details.url.startsWith('file:') })
  })
  const metrics = []
  for (const example of examples) {
    const html = studentReport(base, example.student, example.scale, example.title)
    assert.ok(!html.includes('INTERNAL-DO-NOT-PUBLISH'))
    const file = join(out, `${example.id}.html`)
    writeFileSync(file, html)
    await win.loadFile(file)
    for (const width of [980, 600, 390, 320]) {
      win.setContentSize(width, 1100)
      // Window-manager resize and Chromium paint complete asynchronously.
      await new Promise(resolve => setTimeout(resolve, 150))
      const metric = await win.webContents.executeJavaScript(`new Promise(resolve => requestAnimationFrame(() => resolve({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        clipped: [...document.querySelectorAll('.who,.what,.review li span,.group h2')].filter(el => el.scrollWidth > el.clientWidth + 1).length,
        rows: document.querySelectorAll('.check').length,
        review: document.querySelectorAll('.review li').length,
        headerOverlap: (() => {
          const a = document.querySelector('.who').getBoundingClientRect();
          const b = document.querySelector('.grade').getBoundingClientRect();
          return a.right > b.left + 1 && a.bottom > b.top + 1 && a.left < b.right && a.top < b.bottom;
        })()
      })))`)
      assert.ok(Math.abs(metric.width - width) <= 3, `${example.id}: resize did not settle at ${width}`)
      assert.ok(metric.scrollWidth <= metric.width, `${example.id}: horizontal overflow at ${width}`)
      assert.equal(metric.clipped, 0, `${example.id}: clipped text at ${width}`)
      assert.equal(metric.headerOverlap, false, `${example.id}: overlapping name and grade at ${width}`)
      assert.equal(metric.rows, example.student.checks.length)
      assert.equal(metric.review, Math.min(8, example.student.checks.filter(c => c.status === 'FAIL').length))
      metrics.push({ example: example.id, ...metric })
      if ((width === 980 || width === 390) && example.id !== 'extremo') {
        writeFileSync(join(out, `${example.id}-${width}.png`), (await win.webContents.capturePage()).toPNG())
      }
    }
    win.setContentSize(980, 1100)
    await new Promise(resolve => setTimeout(resolve, 150))
    if (['corto', 'mixto', 'largo', 'extremo'].includes(example.id)) {
      writeFileSync(join(out, `${example.id}.pdf`), await win.webContents.printToPDF({
        pageSize: 'A4', preferCSSPageSize: true, printBackground: true
      }))
    }
    if (['corto', 'largo'].includes(example.id)) {
      // Explicit economy mode overrides the document's print-color-adjust.
      await win.webContents.insertCSS('@media print {html{-webkit-print-color-adjust:economy!important;print-color-adjust:economy!important}body{filter:grayscale(1)}}')
      writeFileSync(join(out, `${example.id}-sin-fondos-gris.pdf`), await win.webContents.printToPDF({
        pageSize: 'A4', preferCSSPageSize: true, printBackground: false
      }))
    }
  }
  assert.deepEqual(network, [])
  writeFileSync(join(out, 'verification.json'), JSON.stringify({ metrics, network }, null, 2) + '\n')
  console.log(JSON.stringify({ examples: examples.length, viewportChecks: metrics.length, network }))
  win.destroy()
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
