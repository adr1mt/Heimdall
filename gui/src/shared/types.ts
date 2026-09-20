// Types that cross the IPC boundary. The evaluation model is not here yet: it
// arrives with the native contract (docs/design/09-CONTRATO-GUI.md).

/** Result of locating the engine and asking it for its version. */
export interface EngineStatus {
  /** The binary exists, answers and identifies itself as Heimdall. */
  found: boolean
  /** The path it was called with. */
  path: string
  /** Engine version, when it could be read. */
  version: string | null
  /** Why it cannot be used, in Spanish and for the teacher. */
  problem: string | null
}

export interface HeimdallApi {
  detectEngine: () => Promise<EngineStatus>
  getEnginePath: () => Promise<string>
  setEnginePath: (path: string) => Promise<EngineStatus>
  pickFile: (kind: 'exam' | 'class' | 'engine') => Promise<string | null>
  openExternal: (url: string) => Promise<void>
}
