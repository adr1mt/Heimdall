import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { DownloadBudget, downloadUpdate, MAX_UPDATE_BYTES } from '../src/main/update-download'
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('bounds actual bytes even without Content-Length', async () => {
  const sink = new Writable({ write(_chunk, _encoding, done) { done() } })
  await expect(pipeline(Readable.from([Buffer.alloc(5), Buffer.alloc(5)]), new DownloadBudget(8), sink)).rejects.toThrow(/tamaño/)
})
it('rejects an oversized response before writing', async () => {
  const dest = join(mkdtempSync(join(tmpdir(), 'heimdall-update-')), 'new.AppImage')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { headers: { 'content-length': String(MAX_UPDATE_BYTES + 1) } })))
  await expect(downloadUpdate('https://example.invalid/file', dest, new AbortController().signal)).rejects.toThrow(/tamaño/)
  expect(existsSync(dest)).toBe(false); expect(existsSync(dest + '.part')).toBe(false)
})
it('cancels a stalled stream and removes its partial', async () => {
  const dest = join(mkdtempSync(join(tmpdir(), 'heimdall-update-')), 'new.AppImage'), controller = new AbortController()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])) } }))))
  const pending = downloadUpdate('https://example.invalid/file', dest, controller.signal)
  setTimeout(() => controller.abort(), 10)
  await expect(pending).rejects.toThrow()
  expect(existsSync(dest)).toBe(false); expect(existsSync(dest + '.part')).toBe(false)
})
it('enforces the download deadline on a stream that never ends', async () => {
  const dest = join(mkdtempSync(join(tmpdir(), 'heimdall-update-')), 'new.AppImage'), deadline = new AbortController()
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])) } }))))
  const pending = downloadUpdate('https://example.invalid/file', dest, new AbortController().signal)
  setTimeout(() => deadline.abort(), 10)
  await expect(pending).rejects.toThrow()
  expect(timeout).toHaveBeenCalledWith(180_000)
  expect(existsSync(dest)).toBe(false); expect(existsSync(dest + '.part')).toBe(false)
})
