// Real renderer/preload/IPC, isolated profile and fictional class only.
import { app, BrowserWindow } from 'electron'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { registerIpc } from '../src/main/ipc'
import { writeClasses } from '../src/main/classes'
import { IPC } from '../src/shared/ipc'

const profile = mkdtempSync(join(tmpdir(), 'heimdall-notices-'))
const out = resolve(process.env.NOTICE_OUT || '../docs/reviews/evidence/T187')
app.setPath('userData', profile)
app.disableHardwareAcceleration()
writeClasses(profile, [{ id: 'demo', name: 'Clase ficticia', columns: [], password: 'HEIMDALL_FICTIONAL_NOTICE_TEST',
  students: [{ id: 'demo', name: 'Alumno ficticio', contact: '', host: '127.1.2.3', port: '2201', user: 'alumno', fields: {} }] }])
writeFileSync(join(profile, 'settings.json'), JSON.stringify({ enginePath: resolve('../bin/heimdall') }))
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

void app.whenReady().then(async () => {
  let win: BrowserWindow | undefined
  try {
    mkdirSync(out, { recursive: true })
    registerIpc()
    win = new BrowserWindow({ width: 1280, height: 820, show: true,
      webPreferences: { preload: resolve('out/preload/index.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
    const js = (source: string) => win!.webContents.executeJavaScript(source)
    const until = async (expression: string) => {
      for (let i = 0; i < 100; i++) {
        if (await js(expression)) return
        await delay(50)
      }
      throw new Error(`Visible assertion failed: ${expression}`)
    }
    const click = async (text: string) => {
      await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()===${JSON.stringify(text)} && !b.disabled)`)
      await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`)
    }
    const capture = async (name: string) => {
      await delay(150)
      writeFileSync(join(out, name), (await win!.capturePage()).toPNG())
    }
    const success = `document.querySelector('main > [role="status"]')`
    const error = `document.querySelector('main > [role="alert"]')`
    await win.loadFile(resolve('out/renderer/index.html'))
    await click('Clases')
    await click('Editar')
    await click('Guardar')
    await until(`${success}?.textContent.includes('Clase guardada.')`)
    assert(await js(`${success}.classList.contains('text-success-strong')`))
    assert(await js(`${success}.querySelector('svg.lucide-circle-check') !== null`))
    assert.equal(await js(error), null)
    await capture('success-dark.png')
    await click('Tema claro')
    await capture('success-light.png')
    await delay(5200)
    assert.equal(await js(success), null, 'saved confirmation must disappear without clicking X')
    await capture('dismissed-light.png')

    // An operational problem replaces an active confirmation. Its old timer
    // must not hide the problem, including when the teacher changes section.
    await click('Editar')
    await click('Guardar')
    await until(`${success}?.textContent.includes('Clase guardada.')`)
    win.webContents.send(IPC.backupWarning, 'No se pudo guardar la copia de prueba ficticia.')
    await until(`${error}?.textContent.includes('copia de prueba ficticia')`)
    await click('Inicio')
    await delay(5200)
    assert(await js(`${error}?.classList.contains('text-destructive-strong')`))
    assert(await js(`${error}.querySelector('svg.lucide-triangle-alert') !== null`))
    await capture('error-light.png')
    await click('Tema oscuro')
    await capture('error-dark.png')
    await js(`${error}.querySelector('button').click()`)
    assert.equal(await js(error), null, 'manual close must still work')
    console.log('PASS: actual class save, success color/icon/status in both themes, automatic dismissal, persistent replacement error across navigation, manual close.')
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    win?.destroy()
    rmSync(profile, { recursive: true, force: true })
    app.exit(process.exitCode ?? 0)
  }
})
