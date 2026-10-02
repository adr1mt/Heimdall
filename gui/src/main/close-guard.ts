/**
 * Closing the window mid-correction kills the evaluation of the whole class,
 * so it asks first.
 *
 * It is decided in the main process and not in the renderer so that the
 * warning still appears if the interface has got stuck, and it lives in its
 * own module so the acceptance harness can drive the same code the teacher
 * gets instead of a copy of it.
 */

import { dialog, type BrowserWindow } from 'electron'
import { cancelActiveRun, endExamMode, finishCorrections, isExamModeActive, isRunActive } from './ipc'

/** Set when the quit was asked of the application: log out, `kill`, Ctrl+Q. */
let quitRequested = false

/**
 * A dialog during a system shutdown would leave it hanging, so from here on
 * the window closes without asking.
 */
export function allowQuit(): void {
  quitRequested = true
  endExamMode()
  cancelActiveRun()
}

export function guardClose(win: BrowserWindow): void {
  let confirmed = false
  win.on('close', (event) => {
    if (quitRequested || confirmed) return
    // Exam mode counts even when no engine is alive: between two passes there
    // is none for almost the whole interval, and closing ends the chain.
    const running = isRunActive()
    if (!running && !isExamModeActive()) return
    event.preventDefault()
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Seguir corrigiendo', 'Cerrar y detener'],
      defaultId: 0,
      cancelId: 0,
      title: 'Hay una corrección en marcha',
      message: running ? 'Se está corrigiendo la clase.' : 'El modo examen está activo.',
      detail:
        'Si cierras ahora se detiene la corrección. Lo ya corregido se conserva, y lo que quede sin comprobar aparecerá sin evaluar, nunca suspenso.'
    })
    if (choice !== 1) return
    confirmed = true
    endExamMode()
    // Cancelled, never killed: the engine writes the partial artifact and
    // what the class had already earned is kept.
    cancelActiveRun()
    void finishCorrections().then(() => { if (!win.isDestroyed()) win.close() })
  })
}
