/**
 * A class: a fixed group the teacher writes down once and reuses in every
 * exam of the course (ADR-0021).
 *
 * It is an address book and nothing else. No grade is computed from it, no
 * password is ever part of it, and the engine never reads it: what reaches a
 * correction is still the exam, the classroom file and the credentials typed
 * for that run.
 */
export interface ClassStudent {
  /** What the exam calls this student, e.g. «alu1». */
  id: string
  name: string
  /** Email or Moodle identifier. What it is used for is the teacher's call. */
  contact: string
  /** Fixed exam address of the machine. */
  host: string
  /** User the correction connects with. */
  user: string
}

export interface ClassGroup {
  /** Stable internal identifier. The teacher never sees it. */
  id: string
  /** The logical name, e.g. «2SMX A». */
  name: string
  students: ClassStudent[]
}

/** An empty row, for the screen. */
export function emptyStudent(): ClassStudent {
  return { id: '', name: '', contact: '', host: '', user: '' }
}

/**
 * Reads one student from anything, keeping only the fields of the model.
 *
 * Everything else is dropped on purpose: a hand-edited file that carried a
 * `password` would otherwise be read back, written again and end up on disk
 * forever (ADR-0009, ADR-0021 §4).
 */
export function readStudent(value: unknown): ClassStudent | null {
  const raw = (value ?? {}) as Record<string, unknown>
  const student: ClassStudent = {
    id: text(raw.id),
    name: text(raw.name),
    contact: text(raw.contact),
    host: text(raw.host),
    user: text(raw.user)
  }
  // A row with no identifier is not a student: the exam would have nothing to
  // call it by.
  return student.id ? student : null
}

export function readGroup(value: unknown): ClassGroup | null {
  const raw = (value ?? {}) as Record<string, unknown>
  const id = text(raw.id)
  const name = text(raw.name)
  if (!id || !name) return null
  const students = Array.isArray(raw.students)
    ? raw.students.map(readStudent).filter((s): s is ClassStudent => s !== null)
    : []
  return { id, name, students }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * What is wrong with a class before it is saved, in the teacher's words, or
 * null when there is nothing wrong.
 *
 * A half-saved class is worse than one that refuses to save: it looks right
 * in the list and fails at the worst moment, with the class already sitting
 * in front of the machines.
 */
export function problemWith(group: ClassGroup, others: ClassGroup[]): string | null {
  if (!group.name.trim()) return 'La clase necesita un nombre.'
  const clash = others.find(
    (other) => other.id !== group.id && other.name.trim().toLowerCase() === group.name.trim().toLowerCase()
  )
  if (clash) return `Ya hay una clase que se llama «${clash.name}».`
  if (group.students.length === 0) return 'La clase no tiene ningún alumno.'

  const seen = new Set<string>()
  for (const student of group.students) {
    if (!student.id.trim()) return 'Hay un alumno sin identificador.'
    if (!student.name.trim()) return `«${student.id}» no tiene nombre.`
    if (!student.host.trim()) return `«${student.id}» no tiene dirección de máquina.`
    if (!student.user.trim()) return `«${student.id}» no tiene usuario de conexión.`
    const key = student.id.trim().toLowerCase()
    if (seen.has(key)) return `El identificador «${student.id}» está repetido.`
    seen.add(key)
  }
  return null
}

/** «2SMX A · 15 alumnos», the one line that says which class is chosen. */
export function groupLine(group: ClassGroup): string {
  const count = group.students.length
  return `${group.name} · ${count === 1 ? '1 alumno' : `${count} alumnos`}`
}

/**
 * A copy of a class, under its own name and its own identifier. The students
 * come along; nothing is shared with the original afterwards.
 */
export function duplicateOf(group: ClassGroup, others: ClassGroup[], id: string): ClassGroup {
  const taken = new Set(others.map((other) => other.name.trim().toLowerCase()))
  let name = `${group.name} (copia)`
  for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${group.name} (copia ${n})`
  return { id, name, students: group.students.map((student) => ({ ...student })) }
}
