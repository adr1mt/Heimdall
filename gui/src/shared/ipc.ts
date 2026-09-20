// IPC channel names, shared by the main process and the preload bridge.
export const IPC = {
  detectEngine: 'engine:detect',
  getEnginePath: 'settings:getEnginePath',
  setEnginePath: 'settings:setEnginePath',
  pickFile: 'dialog:pickFile',
  openExternal: 'shell:openExternal'
} as const
