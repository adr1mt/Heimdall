import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GENERATED_MARK, aulaFileName, aulaYaml, isGeneratedName } from '../shared/aula'
import type { ClassGroup } from '../shared/classes'

/**
 * Writes the classroom of a class into the project's folder and returns its
 * file name, which is what the engine is told (ADR-0022).
 *
 * It refuses rather than overwrite anything it did not write. Two locks, not
 * one: the reserved name, and the mark inside the file. The second is what
 * saves a teacher who happened to name a file the same way by hand —
 * unlikely, and losing their classroom is not an acceptable price for
 * «unlikely» (principio 2).
 */
export function writeGeneratedAula(projectDir: string, group: ClassGroup): string {
  const name = aulaFileName(group)
  if (!isGeneratedName(name)) {
    throw new Error(`«${name}» no es un nombre reservado de la aplicación.`)
  }
  const path = join(projectDir, name)
  if (existsSync(path) && !isGenerated(path)) {
    throw new Error(
      `«${name}» ya existe en la carpeta del examen y no lo escribió Heimdall. No se toca: ` +
        'muévelo o renómbralo y vuelve a corregir.'
    )
  }
  mkdirSync(projectDir, { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, aulaYaml(group), 'utf-8')
  renameSync(tmp, path)
  return name
}

/** Whether the file on disk carries the application's mark on its first line. */
function isGenerated(path: string): boolean {
  try {
    return readFileSync(path, 'utf-8').startsWith(GENERATED_MARK)
  } catch {
    // Unreadable is not «ours». Refusing costs a message; guessing costs a
    // classroom.
    return false
  }
}
