import { readFileSync, statSync } from 'node:fs'
import { parseArtifact, type RunResult } from '../shared/artifact'

/**
 * Largest artifact this reads. A class of thirty with twenty checks fits well
 * inside it; anything bigger is said out loud instead of freezing the window
 * while it loads.
 */
const MAX_ARTIFACT = 64 << 20

/** Reads the artifact of one run from disk. */
export function readArtifact(path: string): RunResult {
  let size: number
  try {
    size = statSync(path).size
  } catch {
    throw new Error(`No se encuentra el fichero de resultados «${path}».`)
  }
  if (size > MAX_ARTIFACT) {
    throw new Error(
      `El fichero de resultados ocupa ${Math.round(size / (1 << 20))} MB y la aplicación no abre más de ${MAX_ARTIFACT >> 20} MB.`
    )
  }
  return parseArtifact(readFileSync(path, 'utf-8'))
}
