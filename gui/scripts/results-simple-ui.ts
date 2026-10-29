// Isolated T223 proof, with fictitious in-memory fixtures and a disposable profile.
import { app, BrowserWindow } from 'electron'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
const base = mkdtempSync(join(tmpdir(), 'heimdall-simple-ui-'))
const out = resolve(process.env.RESULTS_UI_OUT || '../docs/reviews/evidence/T223')
mkdirSync(out, { recursive: true }); app.setPath('userData', join(base, 'profile'))
app.disableHardwareAcceleration(); app.commandLine.appendSwitch('force-device-scale-factor', '1')
const css = readdirSync('out/renderer/assets').find(n => n.startsWith('index-') && n.endsWith('.css'))!
writeFileSync(join(base, 'style.css'), readFileSync(join('out/renderer/assets', css)))
for (const [name, bundle] of [['results', '/tmp/heimdall-results-fixture.js'], ['session', '/tmp/heimdall-session-fixture.js']]) {
 writeFileSync(join(base, `${name}.js`), readFileSync(bundle))
 writeFileSync(join(base, `${name}.html`), `<html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="${name}.js"></script></body></html>`)
}
app.whenReady().then(async () => {
 const win = new BrowserWindow({width:1366,height:768,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}})
 const errors: string[] = [], proof: unknown[] = []
 win.webContents.on('console-message', e => {if(e.level==='error') errors.push(e.message)})
 const js = (code: string) => win.webContents.executeJavaScript(code)
 const wait = () => new Promise(r => setTimeout(r,250))
 const click = async (text: string, aria=false) => {
  await js(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>${aria?'e.getAttribute("aria-label")':'e.textContent.trim()'}===${JSON.stringify(text)});if(!e||e.disabled)throw Error('Missing '+${JSON.stringify(text)});e.click()})()`); await wait()
 }
 const menu = async (text: string) => {await js(`(()=>{const e=[...document.querySelectorAll('.results-options > summary')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(text)}));if(!e)throw Error('Missing menu');if(!e.parentElement.open)e.click()})()`); await wait()}
 const close = async () => {await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await wait()}
 const shot = async (name: string) => {await wait();writeFileSync(join(out,`${name}.png`),(await win.webContents.capturePage()).toPNG())}
 const clean = async () => {
  const text = await js('document.body.innerText')
  for (const phrase of ['Última completada','Nota principal:','Nota media','Comprobación con más fallos','Superados / alumnos visibles','Última:']) assert.ok(!text.includes(phrase),phrase)
  assert.equal(await js(`document.querySelectorAll('thead button[aria-label^="Ocultar"],tbody th [aria-label*="alumnos visibles han superado"]').length`),0)
  assert.equal(await js(`document.documentElement.scrollWidth<=innerWidth`),true)
 }
 await win.loadFile(join(base,'session.html'));await wait();await clean()
 assert.ok(await js(`document.querySelector('[role="timer"]').textContent.includes(':')`))
 assert.equal(await js(`document.querySelectorAll('thead th[data-column]').length`),14)
 assert.ok(await js(`document.querySelector('thead th[data-column]').textContent.includes('10,0')`),'Best grade retained')
 for(const [width,height] of [[1366,768],[1920,1080]]){
  win.setSize(width,height);await wait();await shot(`teacher-${width}`)
  const geometry=await js(`(()=>{const r=document.querySelector('table').getBoundingClientRect();return {top:r.top,bottom:r.bottom,header:document.querySelector('thead').getBoundingClientRect().height}})()`)
  assert.ok(geometry.top<180,JSON.stringify(geometry));proof.push({teacher:width,geometry})
 }
 await js('window.examFixture.projector()');await wait();await click('Ajustar a pantalla',true)
 for(const [width,height] of [[1366,768],[1024,768]]){
  win.setSize(width,height);await wait();await shot(`projector-class-${width}`)
  assert.ok(await js(`(()=>{const c=document.querySelector('.projector-content'),v=c.parentElement;return v.scrollHeight<=v.clientHeight+2&&v.scrollWidth<=v.clientWidth+2})()`))
 }
 await js('window.examFixture.projector()');await wait()
 await click('Pausar');assert.equal(await js(`document.querySelector('[role="timer"]').textContent.trim()`),'Pausado')
 await click('Reanudar');assert.ok(await js(`document.querySelector('[role="timer"]').textContent.includes(':')`))
 await click('Finalizar examen');assert.ok(await js(`!!document.querySelector('[data-testid="final-grades"]')`))
 proof.push({session:'best grade, pause, resume, finalization PASS'})
 await win.loadFile(join(base,'results.html'));await wait()
 await js(`window.resultsConnections();window.resultsProjector(true);window.resultsTest.view.getState().setMode('matrix')`);await wait();await clean()
 assert.equal(await js(`document.querySelectorAll('button[aria-label^="Ocultar"]').length`),0)
 assert.ok(await js(`document.querySelector('thead').innerText.includes('Provisional')`))
 assert.ok(await js(`document.querySelectorAll('thead th[data-column]')[4].textContent.includes('—')`))
 await menu('Alumnos');await js(`document.querySelector('.results-options[open] input').click()`);await wait()
 assert.equal(await js(`document.querySelectorAll('thead th[data-column]').length`),4)
 await click('Mostrar todos');await close();await menu('Filtros');await click('Evaluados');await close()
 assert.equal(await js(`document.querySelectorAll('thead th[data-column]').length`),3)
 await menu('Filtros');await click('Todos');await close()
 await js(`document.querySelector('[role="separator"]').focus()`)
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'Right'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Right'});await wait()
 const keyed=await js(`window.resultsTest.view.getState().checkWidth`);assert.ok(keyed>=180)
 const b=await js(`(()=>{const r=document.querySelector('[role="separator"]').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`)
 win.webContents.sendInputEvent({type:'mouseMove',...b});await wait();win.webContents.sendInputEvent({type:'mouseDown',...b,button:'left',clickCount:1});await wait()
 win.webContents.sendInputEvent({type:'mouseMove',x:b.x+90,y:b.y,movementX:90,modifiers:['leftButtonDown']});await wait();win.webContents.sendInputEvent({type:'mouseUp',x:b.x+90,y:b.y,button:'left',clickCount:1});await wait()
 const dragged=await js(`window.resultsTest.view.getState().checkWidth`);assert.ok(dragged>=keyed+85,`Drag ${keyed} -> ${dragged}`)
 await click('Lista');await click('Matriz');assert.equal(await js(`window.resultsTest.view.getState().checkWidth`),dragged)
 await js(`window.resultsRemount()`);await wait();assert.equal(await js(`window.resultsTest.view.getState().checkWidth`),dragged)
 await js(`window.resultsRefresh('begin')`);await wait()
 assert.ok(await js(`document.querySelector('[role="timer"]').textContent.includes('Corrigiendo')`))
 assert.equal(await js(`document.querySelectorAll('thead th[data-column]').length`),5)
 await js(`window.resultsRefresh('fail')`);await wait()
 assert.ok(await js(`document.body.innerText.includes('Se conservan los resultados anteriores')`))
 assert.ok(await js(`document.querySelector('[role="timer"]').getAttribute('aria-label').startsWith('Próxima corrección en')`))
 await js(`window.resultsRefresh('success')`);await wait();assert.ok(await js(`!document.body.innerText.includes('Se conservan los resultados anteriores')`))
 proof.push({controls:'visibility, filters, pointer, keyboard, remount, refresh/failure PASS',keyed,dragged})
 for(const count of [5,30]){
  await js(`window.resultsFixture(${count},true);window.resultsProjector(true);window.resultsTest.view.getState().setMode('matrix');window.resultsTest.view.getState().setCheckWidth(null)`);await wait()
  for(const [width,height] of [[1024,768],[1366,768],[1920,1080]]){
   win.setSize(width,height);await wait();if(!await js(`!!document.querySelector('.projector-fit')`))await click('Ajustar a pantalla',true);await wait()
   const g=await js(`(()=>{const c=document.querySelector('.projector-content'),v=c.parentElement,t=document.querySelector('table').getBoundingClientRect(),r=v.getBoundingClientRect();return {top:t.top,right:t.right,bottom:t.bottom,viewport:r.toJSON(),scrollX:v.scrollWidth-v.clientWidth,scrollY:v.scrollHeight-v.clientHeight,columns:document.querySelectorAll('thead th[data-column]').length,zoom:getComputedStyle(c).zoom}})()`)
   assert.equal(g.columns,count);assert.ok(g.right<=g.viewport.right+2&&g.bottom<=g.viewport.bottom+2,JSON.stringify(g))
   assert.ok(g.scrollX<=2&&g.scrollY<=2,JSON.stringify(g));assert.ok(g.right>=g.viewport.right-30,'Fitted matrix uses the screen width');assert.ok(g.top<180,JSON.stringify(g));await clean()
   if(width===1024||count===5&&width===1366)await shot(`projector-${count}-${width}`)
   proof.push({count,width,geometry:g})
  }
  await menu('Filtros');await click('Suspensos');await close();await wait()
  assert.ok(await js(`(()=>{const c=document.querySelector('.projector-content'),v=c.parentElement;return v.scrollHeight<=v.clientHeight+2&&v.scrollWidth<=v.clientWidth+2})()`))
  await menu('Filtros');await click('Todos');await close();await click('Aumentar zoom',true);assert.ok(await js(`!document.querySelector('.projector-fit')`))
  await click('Lista');await click('Ajustar a pantalla',true)
  assert.ok(await js(`(()=>{const c=document.querySelector('.projector-content'),v=c.parentElement;return v.scrollHeight<=v.clientHeight+2})()`))
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'proof.json'),JSON.stringify(proof,null,2));console.log(`T223 proof: ${out}`);app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
