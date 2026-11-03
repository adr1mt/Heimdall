import { afterEach, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { CheckOutcome, UpdaterDeps } from '../src/main/updater'

const state = vi.hoisted(() => ({
  deps: null as UpdaterDeps | null,
  chromium: vi.fn(),
  download: vi.fn(),
  busy: false,
  settled: new Set<() => void>(),
  check: vi.fn<() => Promise<CheckOutcome>>(),
  handlers: new Map<string, () => unknown>()
}))
vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.2', isPackaged: true, getPath: () => '/tmp' },
  ipcMain: { handle: (name: string, handler: () => unknown) => state.handlers.set(name, handler) },
  net: { fetch: state.chromium }
}))
vi.mock('../src/main/ipc', () => ({ isUpdateBlocked: () => state.busy }))
vi.mock('../src/main/activity', () => ({
  onCorrectionStarting: vi.fn(),
  onCorrectionSettled: (listener: () => void) => {
    state.settled.add(listener)
    return () => state.settled.delete(listener)
  }
}))
vi.mock('../src/main/update-download', () => ({ downloadUpdate: state.download }))
vi.mock('../src/main/updater', () => ({
  Updater: class {
    latestVersion = '1.0.3'
    check = state.check
    constructor(deps: UpdaterDeps) { state.deps = deps }
  }
}))
import { IPC } from '../src/shared/ipc'
import { registerUpdateIpc, startUpdates } from '../src/main/update-service'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  state.busy = false
  state.settled.clear()
  state.handlers.clear()
  state.check.mockReset()
})

function start(appImage = true) {
  vi.useFakeTimers()
  vi.stubEnv('APPIMAGE', appImage ? '/tmp/Heimdall.AppImage' : undefined)
  registerUpdateIpc()
  let close: () => void = () => {}
  const send = vi.fn()
  startUpdates({
    on: (_event: string, callback: () => void) => { close = callback },
    isDestroyed: () => false,
    webContents: { send }
  } as unknown as BrowserWindow)
  return {
    close: () => close(),
    search: () => state.handlers.get(IPC.checkForUpdates)!(),
    status: () => state.handlers.get(IPC.getUpdateStatus)!(),
    settled: () => state.settled.forEach(listener => listener()),
    send
  }
}

it('uses Chromium for both the release feed and its download, never Node fetch', async () => {
  const nodeFetch = vi.fn(() => { throw new Error('Node transport must not be used') })
  vi.stubGlobal('fetch', nodeFetch)
  state.chromium.mockResolvedValue(new Response('release'))
  start()
  const deps = state.deps!
  const signal = new AbortController().signal
  expect(await deps.fetchText('https://api.github.com/feed', signal)).toBe('release')
  expect(state.chromium).toHaveBeenCalledWith('https://api.github.com/feed', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  state.download.mockImplementation(async (url, _file, _signal, transport) => { await transport(url, { signal }) })
  await deps.download('https://github.com/update.AppImage', '/tmp/update.AppImage', signal)
  expect(state.chromium).toHaveBeenCalledWith('https://github.com/update.AppImage', { signal })
  expect(nodeFetch).not.toHaveBeenCalled()
})

it('shows installed and published versions, reuses an active manual check and cancels the startup timer', async () => {
  state.check.mockResolvedValue('current')
  const app = start()
  expect(app.status()).toEqual({ installedVersion: '1.0.2', latestVersion: null, state: 'idle' })
  const first = app.search()
  expect(app.search()).toBe(first)
  expect(app.status()).toMatchObject({ state: 'checking' })
  await first
  expect(app.status()).toEqual({ installedVersion: '1.0.2', latestVersion: '1.0.3', state: 'current' })
  await vi.advanceTimersByTimeAsync(10_000)
  expect(state.check).toHaveBeenCalledTimes(1)
  app.close()
})

it('queues one retry after startup or a manual request meets classroom activity', async () => {
  state.busy = true
  state.check.mockResolvedValue('ready')
  const app = start()
  await vi.advanceTimersByTimeAsync(10_000)
  await app.search()
  app.settled()
  expect(state.check).not.toHaveBeenCalled()
  expect(app.status()).toMatchObject({ state: 'busy' })
  state.busy = false
  app.settled()
  app.settled()
  await app.search()
  expect(state.check).toHaveBeenCalledTimes(1)
  expect(app.status()).toMatchObject({ state: 'ready' })
  app.close()
})

it('retries after an abort even if the correction ended before the request settled', async () => {
  let finish!: (outcome: CheckOutcome) => void
  state.check.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce('failed')
  const app = start()
  const first = app.search()
  app.settled()
  expect(state.check).toHaveBeenCalledTimes(1)
  finish('busy')
  await first
  await vi.advanceTimersByTimeAsync(0)
  expect(state.check).toHaveBeenCalledTimes(2)
  expect(app.status()).toMatchObject({ state: 'failed' })
  app.close()
})

it('does not retry a deferred check after the window closes', async () => {
  state.busy = true
  const app = start()
  await app.search()
  app.close()
  state.busy = false
  app.settled()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(state.check).not.toHaveBeenCalled()
})

it('does not check updates from an installation outside AppImage', async () => {
  const app = start(false)
  expect(app.status()).toMatchObject({ state: 'unsupported' })
  await app.search()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(state.check).not.toHaveBeenCalled()
})
