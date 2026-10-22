import { afterEach, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { UpdaterDeps } from '../src/main/updater'

const state = vi.hoisted(() => ({
  deps: null as UpdaterDeps | null,
  chromium: vi.fn(),
  download: vi.fn()
}))
vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0', isPackaged: false, getPath: () => '/tmp' },
  net: { fetch: state.chromium }
}))
vi.mock('../src/main/ipc', () => ({ isRunActive: () => false, isExamModeActive: () => false }))
vi.mock('../src/main/activity', () => ({ onCorrectionStarting: vi.fn() }))
vi.mock('../src/main/update-download', () => ({ downloadUpdate: state.download }))
vi.mock('../src/main/updater', () => ({
  Updater: class {
    constructor(deps: UpdaterDeps) { state.deps = deps }
  }
}))
import { startUpdates } from '../src/main/update-service'
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks() })

it('uses Chromium for both the release feed and its download, never Node fetch', async () => {
  vi.useFakeTimers()
  const nodeFetch = vi.fn(() => { throw new Error('Node transport must not be used') })
  vi.stubGlobal('fetch', nodeFetch)
  state.chromium.mockResolvedValue(new Response('release'))
  startUpdates({ on: vi.fn() } as unknown as BrowserWindow)
  const deps = state.deps!
  const signal = new AbortController().signal
  expect(await deps.fetchText('https://api.github.com/feed', signal)).toBe('release')
  expect(state.chromium).toHaveBeenCalledWith('https://api.github.com/feed', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  state.download.mockImplementation(async (url, _file, _signal, transport) => { await transport(url, { signal }) })
  await deps.download('https://github.com/update.AppImage', '/tmp/update.AppImage', signal)
  expect(state.chromium).toHaveBeenCalledWith('https://github.com/update.AppImage', { signal })
  expect(nodeFetch).not.toHaveBeenCalled()
})
