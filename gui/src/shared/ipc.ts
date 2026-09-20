// IPC channel names, shared by the main process and the preload bridge.
export const IPC = {
  detectEngine: 'engine:detect',
  getEnginePath: 'settings:getEnginePath',
  setEnginePath: 'settings:setEnginePath',
  pickFile: 'dialog:pickFile',
  openExternal: 'shell:openExternal',
  secretRefs: 'run:secretRefs',
  startRun: 'run:start',
  cancelRun: 'run:cancel',
  readArtifact: 'run:artifact',
  listRuns: 'history:list',
  // Pushed from the main process while a run is alive.
  runEvent: 'run:event',
  runClosed: 'run:closed'
} as const
