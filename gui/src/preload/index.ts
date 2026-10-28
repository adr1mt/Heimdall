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
  pickDirectory: () => ipcRenderer.invoke(IPC.pickDirectory),
  recentProjects: () => ipcRenderer.invoke(IPC.recentProjects),
  openProject: (dir) => ipcRenderer.invoke(IPC.openProject, dir),
  createProject: (dir) => ipcRenderer.invoke(IPC.createProject, dir),
  removeRecent: (dir) => ipcRenderer.invoke(IPC.removeRecent, dir),
  readExam: (examPath) => ipcRenderer.invoke(IPC.readExam, examPath),
  writeExam: (examPath, yaml) => ipcRenderer.invoke(IPC.writeExam, examPath, yaml),
  recoverExam: (examPath) => ipcRenderer.invoke(IPC.recoverExam, examPath),
  recoverClasses: () => ipcRenderer.invoke(IPC.recoverClasses),
  validateExam: (request) => ipcRenderer.invoke(IPC.validateExam, request),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  secretRefs: (classId) => ipcRenderer.invoke(IPC.secretRefs, classId),
  describe: (paths) => ipcRenderer.invoke(IPC.describe, paths),
  openFolder: (path) => ipcRenderer.invoke(IPC.openFolder, path),
  startRun: (request: RunRequest) => ipcRenderer.invoke(IPC.startRun, request),
  cancelRun: () => ipcRenderer.invoke(IPC.cancelRun),
  setExamMode: (request) => ipcRenderer.invoke(IPC.setExamMode, request),
  readArtifact: (path) => ipcRenderer.invoke(IPC.readArtifact, path),
  consolidate: (path) => ipcRenderer.invoke(IPC.consolidate, path),
  session: (roundPaths) => ipcRenderer.invoke(IPC.session, roundPaths),
  savedExam: (path, classId, id) => ipcRenderer.invoke(IPC.savedExam, path, classId, id),
  examRecords: (path, classId) => ipcRenderer.invoke(IPC.examRecords, path, classId),
  finishExam: (path, classId, passMark) => ipcRenderer.invoke(IPC.finishExam, path, classId, passMark),
  sendFinalReports: (path, classId, id, scale) => ipcRenderer.invoke(IPC.sendFinalReports, path, classId, id, scale),
  listRuns: (examPath) => ipcRenderer.invoke(IPC.listRuns, examPath),
  listBackups: (examPath) => ipcRenderer.invoke(IPC.listBackups, examPath),
  restoreBackups: (examPath) => ipcRenderer.invoke(IPC.restoreBackups, examPath),
  saveCsv: (name, text) => ipcRenderer.invoke(IPC.saveCsv, name, text),
  sendReports: (artifactPath, file, reports) => ipcRenderer.invoke(IPC.sendReports, artifactPath, file, reports),
  listClasses: () => ipcRenderer.invoke(IPC.listClasses),
  saveClasses: (classes) => ipcRenderer.invoke(IPC.saveClasses, classes),
  onBackupWarning: (listener) => subscribe<string>(IPC.backupWarning, listener),
  onRunEvent: (listener) => subscribe<EngineEvent>(IPC.runEvent, listener),
  onRunClosed: (listener) => subscribe<RunClosed>(IPC.runClosed, listener),
  onUpdateReady: (listener) => subscribe<string>(IPC.updateReady, listener)
}

contextBridge.exposeInMainWorld('heimdall', api)
