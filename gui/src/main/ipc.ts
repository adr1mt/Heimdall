import { app, dialog, ipcMain, shell } from 'electron'
import { IPC } from '../shared/ipc'
import { detectEngine } from './engine'
import { readSettings, writeSettings } from './store'
import type { EngineStatus } from '../shared/types'

const FILTERS: Record<'exam' | 'class' | 'engine', Electron.FileFilter[]> = {
  exam: [{ name: 'Examen', extensions: ['yaml', 'yml'] }],
  class: [{ name: 'Aula', extensions: ['yaml', 'yml'] }],
  engine: [{ name: 'Motor', extensions: ['*'] }]
}

/** Where the settings file lives: the app's own data directory. */
function settingsDir(): string {
  return app.getPath('userData')
}

export function registerIpc(): void {
  ipcMain.handle(IPC.detectEngine, (): Promise<EngineStatus> =>
    detectEngine(readSettings(settingsDir()).enginePath)
  )

  ipcMain.handle(IPC.getEnginePath, (): string => readSettings(settingsDir()).enginePath)

  ipcMain.handle(IPC.setEnginePath, async (_e, path: unknown): Promise<EngineStatus> => {
    const enginePath = typeof path === 'string' ? path.trim() : ''
    if (!enginePath) throw new Error('La ruta del motor no puede estar vacía.')
    writeSettings(settingsDir(), { ...readSettings(settingsDir()), enginePath })
    return detectEngine(enginePath)
  })

  ipcMain.handle(IPC.pickFile, async (_e, kind: unknown): Promise<string | null> => {
    const key = kind === 'exam' || kind === 'class' || kind === 'engine' ? kind : 'exam'
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: FILTERS[key] })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  // http(s) only: shell.openExternal opens any scheme the system knows, and a
  // link in the interface has no business launching programs.
  ipcMain.handle(IPC.openExternal, async (_e, url: unknown): Promise<void> => {
    const target = String(url)
    if (!/^https?:\/\//i.test(target)) throw new Error('Enlace no permitido.')
    await shell.openExternal(target)
  })
}
