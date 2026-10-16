import { createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { Readable, Transform, type TransformCallback } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export const MAX_UPDATE_BYTES = 1024 * 1024 * 1024

/**
 * What the download is allowed to take.
 *
 * A fixed three minutes was enough for the first AppImages and not for one of
 * 155 MB on a classroom line: below 0.9 MB/s the update never arrived. What
 * reveals a broken download is that it stops moving, not that it is slow.
 * The deadline only catches a stream that trickles forever.
 */
export interface DownloadLimits {
  /** Without a single byte for this long, the download is given up. */
  stallMs: number
  /** No download, however alive, lasts longer than this. */
  deadlineMs: number
}

export const DOWNLOAD_LIMITS: DownloadLimits = { stallMs: 60_000, deadlineMs: 30 * 60_000 }

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

/** Aborts `stalled` when no bytes have passed for `ms`. */
class StallWatch extends Transform {
  private timer: NodeJS.Timeout

  constructor(private readonly ms: number, private readonly stalled: AbortController) {
    super()
    this.timer = this.arm()
  }

  arm(): NodeJS.Timeout {
    const timer = setTimeout(() => this.stalled.abort(new Error('la descarga se ha quedado parada')), this.ms)
    timer.unref?.()
    return timer
  }

  stop(): void {
    clearTimeout(this.timer)
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
    clearTimeout(this.timer)
    this.timer = this.arm()
    done(null, chunk)
  }
}

/** Whole file or nothing. Cancellation leaves the working AppImage untouched. */
export async function downloadUpdate(url: string, dest: string, signal: AbortSignal, limits: DownloadLimits = DOWNLOAD_LIMITS): Promise<void> {
  // The watch starts before the request: a server that never answers is as
  // stalled as one that stops sending.
  const stalled = new AbortController()
  const watch = new StallWatch(limits.stallMs, stalled)
  const bounded = AbortSignal.any([signal, stalled.signal, AbortSignal.timeout(limits.deadlineMs)])
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
      watch,
      new DownloadBudget(),
      createWriteStream(partial),
      { signal: bounded }
    )
    bounded.throwIfAborted()
    await rename(partial, dest)
  } catch (error) {
    await rm(partial, { force: true }).catch(() => undefined)
    // The pipeline reports a bare AbortError; the log should say why.
    throw stalled.signal.aborted ? stalled.signal.reason : error
  } finally {
    watch.stop()
  }
}
