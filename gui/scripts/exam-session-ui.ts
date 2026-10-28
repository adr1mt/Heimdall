import { app, BrowserWindow } from 'electron'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
const root = mkdtempSync(join(tmpdir(), 'heimdall-session-ui-')), out = resolve('../.impeccable/review')
mkdirSync(out, { recursive: true }); app.setPath('userData', join(root, 'profile')); app.disableHardwareAcceleration(); app.commandLine.appendSwitch('force-device-scale-factor', '1')
const css = readdirSync('out/renderer/assets').find(file => file.startsWith('index-') && file.endsWith('.css'))!
writeFileSync(join(root, 'style.css'), readFileSync(join('out/renderer/assets', css))); writeFileSync(join(root, 'fixture.js'), readFileSync('/tmp/heimdall-session-fixture.js'))
writeFileSync(join(root, 'index.html'), '<html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
app.whenReady().then(async () => {
 const win = new BrowserWindow({ width: 1366, height: 768, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, offscreen: true } }), errors: string[] = []
 win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message) })
 const js = (code: string) => win.webContents.executeJavaScript(code), wait = () => new Promise(resolve => setTimeout(resolve, 250))
 const click = async (text: string) => { await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b || b.disabled)throw Error('Missing '+${JSON.stringify(text)});b.click()})()`); await wait() }
 const shot = async (name: string) => { await wait(); writeFileSync(join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()) }
 await win.loadFile(join(root, 'index.html')); await wait()
 assert.equal(await js(`document.querySelector('.matrix-viewport').scrollWidth > 0`), true)
 assert.equal(await js(`document.body.innerText.includes('Mejor nota · Vuelta 1')`), true)
 assert.equal(await js(`document.body.innerText.includes('Última: 5,0')`), true)
 await shot('desktop'); win.setSize(1024,768); await wait(); await js('window.examFixture.theme(true)'); await wait()
 assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true); await shot('user-1024')
 await click('Mejores notas'); assert.equal(await js(`document.querySelector('[role="alertdialog"]').innerText.includes('Sin nota final')`), true); await shot('best-grades'); await click('Cerrar')
 await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Finalizar examen');b.click();b.click()})()`); await wait()
 assert.equal(await js('window.examFixture.calls'), 1)
 assert.equal(await js(`document.querySelector('[role="alertdialog"]').innerText.includes('a los 13 alumnos')`), true)
 assert.equal(await js(`document.body.innerText.includes('Próxima corrección en')`), false); await shot('final-prompt'); await click('Ahora no')
 assert.equal(await js(`document.body.innerText.includes('Nota final · Vuelta 1')`), true); await shot('finalized')
 await click('Enviar informes finales'); await click('Enviar informes')
 assert.equal(await js(`document.querySelector('[role="alertdialog"]').innerText.includes('13 informes enviados · 0 pendientes · 1 sin nota final')`), true); await shot('delivery-summary')
 await click('Cerrar'); await click('Lista')
 assert.equal(await js(`document.querySelector('.student-row').innerText.includes('Suspenso')`), false)
 await shot('list-finalized')
 await js(`document.querySelector('button[aria-label="Ver detalle: Ana Ferrer"]').click()`); await wait()
 assert.equal(await js(`document.querySelector('strong.text-3xl').textContent.trim()`), '10,0')
 assert.equal(await js(`document.body.innerText.includes('Última vuelta: 5,0')`), true)
 await shot('student-detail')
 assert.deepEqual(errors, [])
 writeFileSync(join(out, 'session-ui.json'), JSON.stringify({ viewports: [1366,1024], maximumAndLatest: 'verified', noGradeReason: 'verified', doubleClick: 'one finalization', sendConfirmation: 'one', finalizedCountdown: 'absent', errors }, null, 2))
 console.log(`Session UI verified: ${out}`); win.destroy(); app.quit()
}).catch(error => { console.error(error); app.exit(1) })
