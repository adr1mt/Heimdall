// IPC channel names, shared by the main process and the preload bridge.
export const IPC = {
  detectEngine: 'engine:detect',
  getEnginePath: 'settings:getEnginePath',
  setEnginePath: 'settings:setEnginePath',
  pickFile: 'dialog:pickFile',
  pickDirectory: 'dialog:pickDirectory',
  recentProjects: 'projects:recent',
  openProject: 'projects:open',
  createProject: 'projects:create',
  removeRecent: 'projects:removeRecent',
  openExternal: 'shell:openExternal',
  secretRefs: 'run:secretRefs',
  describe: 'files:describe',
  openFolder: 'shell:openFolder',
  startRun: 'run:start',
  cancelRun: 'run:cancel',
  setExamMode: 'exam:setMode',
  readArtifact: 'run:artifact',
  consolidate: 'run:consolidate',
  session: 'run:session',
  listRuns: 'history:list',
  saveCsv: 'export:saveCsv',
  listClasses: 'classes:list',
  saveClasses: 'classes:save',
  // Pushed from the main process while a run is alive.
  runEvent: 'run:event',
  runClosed: 'run:closed'
} as const
