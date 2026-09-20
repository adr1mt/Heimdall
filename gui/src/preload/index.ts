import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type { EngineEvent } from '../shared/events'
import type { HeimdallApi, RunClosed, RunRequest } from '../shared/types'

/**
 * Subscribes to a channel the main process pushes on. Only the payload
 * crosses: handing the renderer an IpcRendererEvent would hand it `sender`
 * and with it a way out of the sandbox.
 */
function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

const api: HeimdallApi = {
  detectEngine: () => ipcRenderer.invoke(IPC.detectEngine),
  getEnginePath: () => ipcRenderer.invoke(IPC.getEnginePath),
  setEnginePath: (path) => ipcRenderer.invoke(IPC.setEnginePath, path),
  pickFile: (kind) => ipcRenderer.invoke(IPC.pickFile, kind),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  secretRefs: (classPath) => ipcRenderer.invoke(IPC.secretRefs, classPath),
  startRun: (request: RunRequest) => ipcRenderer.invoke(IPC.startRun, request),
  cancelRun: () => ipcRenderer.invoke(IPC.cancelRun),
  onRunEvent: (listener) => subscribe<EngineEvent>(IPC.runEvent, listener),
  onRunClosed: (listener) => subscribe<RunClosed>(IPC.runClosed, listener)
}

contextBridge.exposeInMainWorld('heimdall', api)
