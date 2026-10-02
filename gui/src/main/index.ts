import { app, BrowserWindow, dialog, session, shell } from 'electron'
import { join } from 'node:path'
import { allowQuit, guardClose } from './close-guard'
import { registerIpc } from './ipc'
import { hasPendingBackups, waitForBackups } from './backup'
import { applyPendingUpdate, startUpdates } from './update-service'

// Avoids the compositor/GPU hangs that are common on Linux (the usual cause
// of "the window is not responding"). The app is light and needs no HW
// acceleration.
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu-compositing')

/**
 * DEVELOPMENT CSP, as an HTTP header. @vitejs/plugin-react injects its React
 * Refresh preamble as an inline <script> in the HTML Vite serves; without
 * 'unsafe-inline' in script-src the CSP blocks it and the renderer stays
 * blank, and only this process can decide that.
 *
 * In the PACKAGED app this header does nothing: the renderer is loaded with
 * `loadFile` (`file://`) and `webRequest` does not take part in that scheme.
 * There the strict policy travels embedded as a <meta> from the build
 * (`inlineCsp` in electron.vite.config.ts). Both lists must stay in step.
 */
function registerCsp(): void {
  const scriptSrc = app.isPackaged ? "script-src 'self' blob:" : "script-src 'self' blob: 'unsafe-inline'"
  const connectSrc = app.isPackaged ? "connect-src 'self'" : "connect-src 'self' ws: wss:"
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    connectSrc,
    // These do not inherit from default-src, so they must be declared.
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'"
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] }
    })
  })
}

/** Window icon. When packaged, electron-builder leaves it in `resources/`. */
function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../build/icon.png')
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    icon: iconPath(),
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    title: 'Heimdall',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.on('will-prevent-unload', (event) => {
    const choice=dialog.showMessageBoxSync(win,{type:'question',buttons:['Volver al editor','Descartar y cerrar'],defaultId:0,cancelId:0,title:'Cambios sin guardar',message:'El borrador del examen no se ha guardado.'})
    if(choice===1) event.preventDefault()
  })

  guardClose(win)
  startUpdates(win)

  // Open external links in the system browser, safe schemes only.
  const isSafeExternal = (url: string): boolean => /^(https?|mailto):/i.test(url)

  win.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternal(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Keep the app from navigating away from its own content.
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault()
      if (isSafeExternal(url)) shell.openExternal(url)
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('before-quit', allowQuit)
app.on('before-quit', (event) => {
  if (!hasPendingBackups()) return
  event.preventDefault()
  void waitForBackups().then(()=>app.quit())
})

// The only moment at which replacing the program cannot interrupt anything:
// the windows are gone and nothing is being corrected.
app.on('will-quit', applyPendingUpdate)

// A single instance: the state of a run lives in this process's memory, and
// two windows would overwrite each other's reports. The second one exits
// without opening anything and brings the first one to the front.
const primaryInstance = app.requestSingleInstanceLock()
if (!primaryInstance) app.exit(0)

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
})

app.whenReady().then(() => {
  if (!primaryInstance) return
  registerCsp()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

/**
 * Safety net: an uncaught async error kills the main process, and with it the
 * evaluation of the whole class. It is logged and the process carries on.
 */
process.on('uncaughtException', (error) => {
  console.error('[heimdall-gui] uncaught exception:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('[heimdall-gui] unhandled rejection:', reason)
})
