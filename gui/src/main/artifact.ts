import { closeSync, fstatSync, openSync, readSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { parseArtifact, type RunResult } from '../shared/artifact'

/** Must match model.MaxArtifactBytes and the PLAN/writer evidence budget. */
export const MAX_ARTIFACT = 64 << 20
const CHUNK_BYTES = 64 << 10

/** Said the same way whether the file was opened or only summarised. */
export function tooBigMessage(size: number): string {
  return `El fichero de resultados ocupa ${Math.round(size / (1 << 20))} MB y la aplicación no abre más de ${MAX_ARTIFACT >> 20} MB.`
}

/** Keeps the exact validated text for restoration without a second disk read. */
export interface ArtifactSnapshot {
  text: string
  run: RunResult
}

function openError(path: string, error: unknown): Error {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
    return new Error(`No se encuentra el fichero de resultados «${path}».`)
  }
  return new Error(`No se pudo abrir el fichero de resultados «${path}»: ${error instanceof Error ? error.message : String(error)}`)
}

function checkSize(size: number): void {
  if (size > MAX_ARTIFACT) throw new Error(tooBigMessage(size))
}

function decode(chunks: Buffer[], bytes: number): ArtifactSnapshot {
  const text = Buffer.concat(chunks, bytes).toString('utf8')
  return { text, run: parseArtifact(text) }
}

/** Reads from one open file; the stat is only an early rejection, not the limit. */
export function readArtifactSnapshot(path: string): ArtifactSnapshot {
  let file: number
  try { file = openSync(path, 'r') } catch (error) { throw openError(path, error) }
  try {
    checkSize(fstatSync(file).size)
    const chunks: Buffer[] = []
    let bytes = 0
    while (true) {
      // One extra byte detects overflow, including growth after stat.
      const buffer = Buffer.allocUnsafe(Math.min(CHUNK_BYTES, MAX_ARTIFACT - bytes + 1))
      const count = readSync(file, buffer, 0, buffer.length, null)
      if (count === 0) return decode(chunks, bytes)
      bytes += count
      checkSize(bytes)
      chunks.push(buffer.subarray(0, count))
    }
  } finally {
    closeSync(file)
  }
}

/** Reads and validates one run for synchronous callers. */
export function readArtifact(path: string): RunResult {
  return readArtifactSnapshot(path).run
}

/** The same contract without blocking disk I/O in history and backup passes. */
export async function readArtifactAsync(path: string): Promise<RunResult> {
  const file = await open(path, 'r').catch(error => { throw openError(path, error) })
  try {
    checkSize((await file.stat()).size)
    const chunks: Buffer[] = []
    let bytes = 0
    while (true) {
      const buffer = Buffer.allocUnsafe(Math.min(CHUNK_BYTES, MAX_ARTIFACT - bytes + 1))
      const { bytesRead } = await file.read(buffer, 0, buffer.length, null)
      if (bytesRead === 0) return decode(chunks, bytes).run
      bytes += bytesRead
      checkSize(bytes)
      chunks.push(buffer.subarray(0, bytesRead))
    }
  } finally {
    await file.close()
  }
}
