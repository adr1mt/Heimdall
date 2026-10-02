import { createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { Readable, Transform, type TransformCallback } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export const MAX_UPDATE_BYTES = 1024 * 1024 * 1024
export const DOWNLOAD_TIMEOUT_MS = 180_000

/** A missing or lying Content-Length must not bypass the download budget. */
export class DownloadBudget extends Transform {
  private bytes = 0

  constructor(private readonly limit = MAX_UPDATE_BYTES) { super() }

  override _flush(done: TransformCallback): void {
    done(this.bytes === 0 ? new Error('la descarga llegó vacía') : undefined)
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
    this.bytes += chunk.length
    if (this.bytes > this.limit) done(new Error('la actualización supera el límite de tamaño'))
    else done(null, chunk)
  }
}

/** Whole file or nothing. Cancellation leaves the working AppImage untouched. */
export async function downloadUpdate(url: string, dest: string, signal: AbortSignal): Promise<void> {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)])
  const partial = `${dest}.part`
  try {
    const response = await fetch(url, { signal: bounded })
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`${response.status} ${response.statusText}`)
    }
    if (!response.body) throw new Error('la descarga llegó vacía')
    const size = response.headers.get('content-length')
    if (size && Number(size) > MAX_UPDATE_BYTES) {
      await response.body.cancel()
      throw new Error('la actualización supera el límite de tamaño')
    }
    await pipeline(
      Readable.fromWeb(response.body as never),
      new DownloadBudget(),
      createWriteStream(partial),
      { signal: bounded }
    )
    bounded.throwIfAborted()
    await rename(partial, dest)
  } catch (error) {
    await rm(partial, { force: true }).catch(() => undefined)
    throw error
  }
}
