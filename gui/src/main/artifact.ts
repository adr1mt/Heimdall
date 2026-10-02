import { readFileSync, statSync } from 'node:fs'
import { parseArtifact, type RunResult } from '../shared/artifact'

/** Must match model.MaxArtifactBytes and the PLAN/writer evidence budget. */
export const MAX_ARTIFACT = 64 << 20

/** Said the same way whether the file was opened or only summarised. */
export function tooBigMessage(size: number): string {
  return `El fichero de resultados ocupa ${Math.round(size / (1 << 20))} MB y la aplicación no abre más de ${MAX_ARTIFACT >> 20} MB.`
}

/** Reads the artifact of one run from disk. */
export function readArtifact(path: string): RunResult {
  let size: number
  try {
    size = statSync(path).size
  } catch {
    throw new Error(`No se encuentra el fichero de resultados «${path}».`)
  }
  if (size > MAX_ARTIFACT) throw new Error(tooBigMessage(size))
  return parseArtifact(readFileSync(path, 'utf-8'))
}
