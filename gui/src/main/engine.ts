import { execFile } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { join } from 'node:path'
import type { EngineStatus } from '../shared/types'

/** Last resort: the bare binary name, looked up in the system PATH. */
export const DEFAULT_ENGINE_PATH = 'heimdall'

/**
 * The engine that travels inside the application, when there is one.
 *
 * The packaged application ships the binary next to its resources, so a
 * teacher who installs it has an engine without installing anything else. In
 * development and in the tests there are no resources, and this answers null.
 */
export function bundledEnginePath(resourcesDir = process.resourcesPath): string | null {
  if (!resourcesDir) return null
  const path = join(resourcesDir, 'heimdall')
  try {
    accessSync(path, constants.X_OK)
    return path
  } catch {
    return null
  }
}

/** With nothing chosen: the engine inside the application, else the PATH. */
export function defaultEnginePath(): string {
  return bundledEnginePath() ?? DEFAULT_ENGINE_PATH
}

/**
 * The engine version inside the line `heimdall version` prints.
 *
 * That line currently carries a prefix from the frozen facade the old GUI
 * needed; it goes away in T060. Matching `heimdall <version>` works with the
 * line of today and with whatever is left afterwards, and it does not accept
 * as an engine a program that does not identify itself as Heimdall.
 */
const VERSION_LINE = /\bheimdall\s+v?([0-9][\w.+-]*)/i

export function parseEngineVersion(output: string): string | null {
  const match = VERSION_LINE.exec(output)
  return match ? match[1] : null
}

function runVersion(path: string): Promise<{ output: string; error: Error | null }> {
  return new Promise((resolve) => {
    // Argument vector, never a string handed to an interpreter.
    execFile(path, ['version'], { timeout: 5000 }, (error, stdout, stderr) => {
      resolve({ output: `${stdout}${stderr}`, error })
    })
  })
}

/**
 * Report whether `path` holds a usable Heimdall engine. It evaluates nothing:
 * it only answers whether the engine can be relied on, and if not, why.
 */
export async function detectEngine(path: string): Promise<EngineStatus> {
  const { output, error } = await runVersion(path)
  const version = parseEngineVersion(output)
  if (version) return { found: true, path, version, problem: null }

  const code = (error as NodeJS.ErrnoException | null)?.code
  const problem =
    code === 'ENOENT'
      ? `No se encuentra el motor en «${path}».`
      : code === 'EACCES'
        ? `El motor de «${path}» no tiene permiso de ejecución.`
        : error
          ? `El motor de «${path}» no responde: ${error.message}`
          : `El programa de «${path}» no es Heimdall.`
  return { found: false, path, version: null, problem }
}
