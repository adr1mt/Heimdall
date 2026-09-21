import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { readGroup, type ClassGroup } from '../shared/classes'

/**
 * Where the teacher's classes live (ADR-0021): one JSON file in the
 * application's own data directory, written atomically.
 *
 * Unlike the settings, an unreadable file here is NOT replaced by an empty
 * list. Re-choosing the engine's path costs ten seconds; writing down
 * twenty-six students again does not. A broken file is reported and left
 * exactly as it is, and saving stays blocked until it is sorted out
 * (ADR-0021 §5, principio 2).
 */
export function classesFile(dir: string): string {
  return join(dir, 'classes.json')
}

export function readClasses(dir: string): ClassGroup[] {
  const path = classesFile(dir)
  if (!existsSync(path)) return []
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (error) {
    throw new Error(
      `No se pudo leer el fichero de clases (${path}). No se ha tocado, y no se puede guardar ninguna clase hasta arreglarlo: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
  const list = Array.isArray((raw as { classes?: unknown })?.classes)
    ? (raw as { classes: unknown[] }).classes
    : null
  if (!list) {
    throw new Error(
      `El fichero de clases (${path}) no tiene la forma esperada. No se ha tocado, y no se puede guardar ninguna clase hasta arreglarlo.`
    )
  }
  return list.map(readGroup).filter((group): group is ClassGroup => group !== null)
}

/**
 * Saves the whole list. It reads first: writing over a file that cannot be
 * read would be losing the teacher's work without saying so.
 *
 * Only the fields of the model are serialized, so nothing that was never part
 * of a class —a password above all— can travel in and back out again.
 */
export function writeClasses(dir: string, classes: ClassGroup[]): void {
  readClasses(dir)
  const path = classesFile(dir)
  const payload = {
    classes: classes.map((group) => ({
      id: group.id,
      name: group.name,
      students: group.students.map((student) => ({
        id: student.id,
        name: student.name,
        contact: student.contact,
        host: student.host,
        user: student.user
      }))
    }))
  }
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  renameSync(tmp, path)
}
