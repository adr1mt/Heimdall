import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { HeimdallApi } from '../shared/types'

const api: HeimdallApi = {
  detectEngine: () => ipcRenderer.invoke(IPC.detectEngine),
  getEnginePath: () => ipcRenderer.invoke(IPC.getEnginePath),
  setEnginePath: (path) => ipcRenderer.invoke(IPC.setEnginePath, path),
  pickFile: (kind) => ipcRenderer.invoke(IPC.pickFile, kind),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url)
}

contextBridge.exposeInMainWorld('heimdall', api)
