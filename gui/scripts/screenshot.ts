// Visual smoke test: starts the real processes (IPC, preload and renderer as
// built) render the window and save a PNG. Not part of the application.
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { registerIpc } from '../src/main/ipc'

const OUT = process.env.SHOT_OUT || '/tmp/heimdall-shot.png'
const root = process.cwd()
const width = Number(process.env.SHOT_WIDTH || 1280)
const height = Number(process.env.SHOT_HEIGHT || 820)

app.whenReady().then(async () => {
  registerIpc()
  const win = new BrowserWindow({
    width,
    height,
    show: true,
    backgroundColor: '#0b0f19',
    webPreferences: {
      // The build emits CommonJS (the sandboxed preload requires it); pointing
      // at an .mjs loads a file that is not there and the renderer ends up
      // without window.heimdall.
      preload: join(root, 'out/preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  await win.loadFile(join(root, 'out/renderer/index.html'))
  await new Promise((r) => setTimeout(r, 2500))
  await win.webContents.executeJavaScript("document.documentElement.classList.add('dark')")
  await new Promise((r) => setTimeout(r, 100))
  writeFileSync(OUT, (await win.webContents.capturePage()).toPNG())
  console.log('[shot] saved to', OUT)

  // Check both themes independently of the saved preference on this machine.
  if (process.env.SHOT_OUT2) {
    await win.webContents.executeJavaScript(
      "document.documentElement.classList.remove('dark')"
    )
    await new Promise((r) => setTimeout(r, 500))
    writeFileSync(process.env.SHOT_OUT2, (await win.webContents.capturePage()).toPNG())
    console.log('[shot] saved to', process.env.SHOT_OUT2)
  }

  app.quit()
})
