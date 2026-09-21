import { emptyStudent, isColumnName, type ClassStudent } from './classes'

/**
 * Writing down a class by hand is twenty-six rows of six fields. The list
 * already exists —in the register, in Moodle, in a spreadsheet— so it is
 * pasted, and this turns that text into students.
 *
 * It never reads a password. A pasted column called `contraseña` is dropped
 * and said so: a class is an address book and no secret is ever part of it
 * (ADR-0009, ADR-0021 §4).
 */

/** One pasted row, as it will be shown before anything is saved. */
export interface PastedRow {
  /** The student this row would add. */
  student: ClassStudent
  /** What this row is missing, in the teacher's words. Empty when it is fine. */
  missing: string[]
}

export interface Paste {
  rows: PastedRow[]
  /** Own columns found in the paste that the class does not have yet. */
  newColumns: string[]
  /** What was left out and why: dropped columns, above all a password. */
  warnings: string[]
}

/** The fixed fields, in the order a paste without a header is read. */
const FIELDS = ['id', 'name', 'contact', 'host', 'port', 'user'] as const
type Field = (typeof FIELDS)[number]

/**
 * What a header cell can be called. The teacher's spreadsheet is in Spanish
 * and nobody is going to rename its columns to match ours.
 */
const HEADERS: Record<Field, string[]> = {
  id: ['id', 'identificador', 'alumno', 'alumne', 'usuario del examen'],
  name: ['nombre', 'nom', 'nombre y apellidos', 'alumno/a', 'apellidos y nombre'],
  contact: ['contacto', 'correo', 'email', 'e-mail', 'moodle'],
  host: ['host', 'maquina', 'máquina', 'ip', 'direccion', 'dirección', 'servidor'],
  port: ['puerto', 'port'],
  user: ['usuario', 'user', 'login', 'cuenta']
}

/** A column that must never reach a saved class, whatever it is called. */
const FORBIDDEN = ['password', 'contraseña', 'contrasena', 'clave', 'passwd', 'pass', 'secreto']

/** What each field is called on screen when a row is missing it. */
const REQUIRED: Partial<Record<Field, string>> = {
  id: 'identificador',
  name: 'nombre',
  host: 'dirección de la máquina',
  user: 'usuario'
}

/**
 * The separator of the pasted text. A spreadsheet pastes tabs; a file saved
 * as CSV brings commas, and the Spanish Excel semicolons. Tabs win when they
 * are there: a name with a comma in it is ordinary and a name with a tab is
 * not.
 */
export function separatorOf(text: string): string {
  if (text.includes('\t')) return '\t'
  if (text.includes(';')) return ';'
  return ','
}

function cells(line: string, separator: string): string[] {
  return line.split(separator).map((cell) => cell.trim().replace(/^"(.*)"$/s, '$1').trim())
}

/** Whether the first row names the columns instead of holding a student. */
function headerOf(first: string[]): (Field | string | null)[] | null {
  const named = first.map((cell) => {
    const clean = cell.trim().toLowerCase()
    for (const field of FIELDS) if (HEADERS[field].includes(clean)) return field as Field
    return clean
  })
  // A header is a header when it names at least the identifier and the name;
  // anything less and the row is a student whose data would be thrown away.
  return named.includes('id') && named.includes('name') ? named : null
}

/**
 * Reads pasted text as students of this class.
 *
 * `columns` are the class's own columns: a paste with a header can fill them
 * by name, and one without a header fills them in the order they are shown,
 * which is the order the table has on screen.
 */
export function readPaste(text: string, columns: string[]): Paste {
  const separator = separatorOf(text)
  // The lines are NOT trimmed: a row that starts with an empty cell begins
  // with the separator, and trimming it would shift every column one to the
  // left and hide which field is really missing.
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return { rows: [], newColumns: [], warnings: [] }

  const first = cells(lines[0], separator)
  const header = headerOf(first)
  const body = header ? lines.slice(1) : lines

  // Which pasted column goes where. Without a header it is the order of the
  // table: the six fixed fields and then the teacher's own columns.
  const layout: (Field | string | null)[] = header ?? [...FIELDS, ...columns]

  const warnings: string[] = []
  const newColumns: string[] = []
  const plan = layout.map((target) => {
    if (target === null) return null
    if (FIELDS.includes(target as Field)) return target
    const name = String(target)
    if (FORBIDDEN.includes(name)) {
      warnings.push(`La columna «${name}» no se ha leído: una clase nunca guarda una contraseña.`)
      return null
    }
    if (!isColumnName(name)) {
      warnings.push(`La columna «${name}» no se ha leído: no vale como nombre de columna.`)
      return null
    }
    if (!columns.includes(name) && !newColumns.includes(name)) newColumns.push(name)
    return name
  })

  const rows = body.map((line) => {
    const values = cells(line, separator)
    const student = emptyStudent()
    for (let i = 0; i < plan.length; i++) {
      const target = plan[i]
      const value = values[i] ?? ''
      if (target === null || value === '') continue
      if (FIELDS.includes(target as Field)) student[target as Field] = value
      else student.fields[target] = value
    }
    const missing = FIELDS.filter((field) => REQUIRED[field] && !student[field]).map(
      (field) => REQUIRED[field] as string
    )
    return { student, missing }
  })

  return { rows, newColumns, warnings }
}

/**
 * The students a paste really adds: the whole rows, and the ones whose
 * identifier is not taken yet. A row that is missing something is shown in
 * red and left out — never saved half (T116).
 */
export function studentsOf(paste: Paste, existing: ClassStudent[]): ClassStudent[] {
  const taken = new Set(existing.map((student) => student.id.trim().toLowerCase()))
  const students: ClassStudent[] = []
  for (const row of paste.rows) {
    if (row.missing.length > 0) continue
    const key = row.student.id.trim().toLowerCase()
    if (taken.has(key)) continue
    taken.add(key)
    students.push(row.student)
  }
  return students
}

/** Rows that repeat an identifier already in the class or earlier in the paste. */
export function duplicatesIn(paste: Paste, existing: ClassStudent[]): number {
  const whole = paste.rows.filter((row) => row.missing.length === 0).length
  return whole - studentsOf(paste, existing).length
}
