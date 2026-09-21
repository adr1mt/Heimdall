import type { ClassGroup, ClassStudent } from './classes'

/**
 * The classroom file the application writes for a class (ADR-0022).
 *
 * It is a DERIVED artifact, not a document: the truth is the saved class, and
 * this is only its projection so the engine can read it. It is rewritten from
 * the class before every correction, so a changed address arrives on its own,
 * and deleting it loses nothing.
 */

/**
 * The prefix the application reserves for itself. A file that does not carry
 * it was not written here and is never touched; a file that carries it was
 * not written by the teacher. That is the whole guarantee against
 * overwriting somebody's `aula.yaml` (ADR-0022 §2).
 */
export const GENERATED_PREFIX = 'aula-heimdall-'

/**
 * The first line of every generated file. It is checked before overwriting:
 * the reserved name says the application owns it, and this says it again
 * inside the file, so a name that somehow collided still cannot be clobbered.
 */
export const GENERATED_MARK = '# Generado por Heimdall. No editar:'

/**
 * The file name of a class's classroom, always the same for the same class.
 *
 * It hangs off the identifier and not the name: the teacher can rename «2SMX
 * A» and the file stays the one it was, instead of leaving a stray copy
 * behind at every rename.
 */
export function aulaFileName(group: ClassGroup): string {
  return `${GENERATED_PREFIX}${group.id}.yaml`
}

/** Whether the application wrote this file, by its name alone. */
export function isGeneratedName(fileName: string): boolean {
  return fileName.startsWith(GENERATED_PREFIX) && fileName.endsWith('.yaml')
}

/**
 * What to call the classroom of a finished correction on screen.
 *
 * A generated file is named after the class it came from, so the name of the
 * class is what goes on screen. A class that was deleted, or a classroom
 * written by hand, keeps its file name: making one up would be inventing the
 * class a grade came from.
 */
export function classNameOf(fileName: string | null, classes: ClassGroup[]): string | null {
  if (!fileName || !isGeneratedName(fileName)) return fileName
  const id = fileName.slice(GENERATED_PREFIX.length, -'.yaml'.length)
  return classes.find((group) => group.id === id)?.name ?? fileName
}

/** The default SSH port. A class only says the port when it is not this one. */
const DEFAULT_PORT = 22

/**
 * The classroom of a class, as the engine reads it.
 *
 * The credential is NAMED and never written: `password_ref` carries the
 * reference and the teacher types the value when correcting (ADR-0009). A
 * literal password in an inventory is a PLAN error, and that does not change
 * because the application wrote the inventory.
 */
export function aulaYaml(group: ClassGroup): string {
  const lines = [
    `${GENERATED_MARK} se rehace a partir de la clase «${group.name}»`,
    '# cada vez que se corrige. Los cambios que escribas aquí se pierden.',
    '#',
    '# La clase se edita en la pantalla «Clases» de la aplicación.',
    '',
    `aula: ${quote(group.name)}`,
    'version: 1',
    '',
    'comun:',
    '  hosts:',
    '    host1:',
    `      puerto: ${DEFAULT_PORT}`,
    '      password_ref: "${AULA_PASSWORD}"',
    '  timeouts:',
    '    conexion: 10s',
    '    alumno: 5m',
    '',
    'alumnos:'
  ]
  for (const student of group.students) lines.push(...studentLines(student, group.columns))
  return `${lines.join('\n')}\n`
}

function studentLines(student: ClassStudent, columns: string[]): string[] {
  const lines = [`  - id: ${quote(student.id)}`, `    nombre: ${quote(student.name)}`]
  // The contact is the teacher's own: it travels so the artifact can carry it
  // to Moodle, and it is not a credential.
  if (student.contact) lines.push(`    moodle_id: ${quote(student.contact)}`)
  // The user is written twice on purpose: the host connects with it, and
  // `${alumno.usuario}` in an exam reads it off the student. Both are the
  // same value, the one the teacher wrote down in the class.
  lines.push(`    usuario: ${quote(student.user)}`)
  lines.push('    hosts:')
  lines.push('      host1:')
  lines.push(`        ip: ${quote(student.host)}`)
  // Only when it differs: an empty port in the class means the usual one, and
  // writing it out anyway would hide which students really are special.
  if (student.port) lines.push(`        puerto: ${student.port}`)
  lines.push(`        usuario: ${quote(student.user)}`)
  // The teacher's own columns, as free keys of the student. That is what
  // `${alumno.subdominio}` in an exam reaches, and it is why a class with
  // columns can correct an exam that asks for more than a machine.
  for (const column of columns) {
    const value = student.fields[column]
    if (value) lines.push(`    ${column}: ${quote(value)}`)
  }
  return lines
}

/**
 * A YAML double-quoted scalar.
 *
 * Everything is quoted, always: a name with a colon, a `#` or a leading digit
 * is ordinary in a class list and would otherwise change what the file means.
 */
function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
