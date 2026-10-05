import { dump, load } from 'js-yaml'

/**
 * The exam, as the editor holds it (T109).
 *
 * There is ONE model. The form and the YAML view are two ways of looking at
 * the same object: the form changes it and the YAML is written from it, and
 * typing in the YAML reads it back. Two models would drift, and a teacher
 * would lose an afternoon's work to whichever of the two happened to win.
 *
 * Nothing here decides anything. The engine validates the exam and the engine
 * computes the grade; this only writes the file the engine reads.
 */

/** The assertions of the format (02-FORMATO.md, M-6…M-10). */
export type AssertionKind = 'contiene' | 'igual_a' | 'no_contiene' | 'exit_code' | 'cerca_de'

export const ASSERTIONS: AssertionKind[] = [
  'contiene',
  'igual_a',
  'no_contiene',
  'exit_code',
  'cerca_de'
]

export interface Assertion {
  kind: AssertionKind
  /** What is expected: the substring, the whole output, the exit code. */
  value: string
  /** `cerca_de` only: the line the search starts from. */
  anchor?: string
  /** `cerca_de` only: how many lines after the anchor are looked at. */
  lines?: string
}

export interface Check {
  id: string
  descripcion: string
  /** Logical host the command runs on. Empty for a `valor:` check. */
  en: string
  /** The command, as a vector of arguments. There is no shell, ever. */
  cmd: string[]
  /** Explicit shared file source. Undefined for commands and inventory values. */
  fichero?: string
  /**
   * A check with no command: the expected value is compared against a field
   * of the inventory, e.g. `${alumno.p1}` (M-11). Empty when there is a cmd.
   */
  valor: string
  assertion: Assertion
  /** Empty means the exam's default. */
  peso: string
  timeout: string
}

export interface Group {
  grupo: string
  comprobaciones: Check[]
}

export interface Exam {
  examen: string
  version: number
  hosts: string[]
  porDefecto: { peso: string; timeout: string }
  grupos: Group[]
}

export function emptyExam(name: string): Exam {
  return {
    examen: name,
    version: 1,
    hosts: ['host1'],
    porDefecto: { peso: '1', timeout: '20s' },
    grupos: []
  }
}

export function emptyCheck(host: string): Check {
  return {
    id: '',
    descripcion: '',
    en: host,
    cmd: [],
    valor: '',
    assertion: { kind: 'contiene', value: '' },
    peso: '',
    timeout: ''
  }
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function readAssertion(raw: Record<string, unknown>): Assertion {
  if (raw.cerca_de && typeof raw.cerca_de === 'object') {
    const near = raw.cerca_de as Record<string, unknown>
    return {
      kind: 'cerca_de',
      value: text(near.contiene),
      anchor: text(near.ancla),
      lines: text(near.lineas ?? 0)
    }
  }
  for (const kind of ['contiene', 'igual_a', 'no_contiene', 'exit_code'] as const) {
    if (raw[kind] !== undefined) return { kind, value: text(raw[kind]) }
  }
  return { kind: 'contiene', value: '' }
}

function readCheck(value: unknown): Check {
  const raw = (value ?? {}) as Record<string, unknown>
  return {
    id: text(raw.id),
    descripcion: text(raw.descripcion),
    en: text(raw.en),
    cmd: Array.isArray(raw.cmd) ? raw.cmd.map(text) : [],
    ...(raw.fichero !== undefined ? { fichero: text(raw.fichero) } : {}),
    valor: text(raw.valor),
    assertion: readAssertion(raw),
    peso: text(raw.peso),
    timeout: text(raw.timeout)
  }
}

/** Reject anything the form cannot represent without discarding input. */
function formatProblem(doc: unknown): string | null {
  const object=(value:unknown,path:string,keys:string[]):Record<string,unknown>=> {
    if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error(`${path}: se esperaba un objeto.`)
    const raw=value as Record<string,unknown>
    for(const key of Object.keys(raw)) if(!keys.includes(key)) throw new Error(`${path}.${key}: clave desconocida.`)
    return raw
  }
  const field=(raw:Record<string,unknown>,key:string,path:string,kind:'string'|'number'|'integer'):void=> {
    if(raw[key]===undefined) return
    const v=raw[key]
    if(typeof v!==(kind==='string'?'string':'number') || (typeof v==='number' && (!Number.isFinite(v) || (kind==='integer' && !Number.isInteger(v))))) throw new Error(`${path}.${key}: tipo incorrecto; se esperaba ${kind==='string'?'texto':'un número'}.`)
  }
  const array=(value:unknown,path:string):unknown[]=> { if(value===undefined) return []; if(!Array.isArray(value)) throw new Error(`${path}: se esperaba una lista.`);return value }
  try {
    const raw=object(doc,'examen',['examen','version','hosts','por_defecto','grupos'])
    field(raw,'examen','examen','string');field(raw,'version','examen','integer')
    for(const host of array(raw.hosts,'hosts')) if(typeof host!=='string') throw new Error('hosts: cada máquina debe ser texto.')
    if(raw.por_defecto!==undefined) {
      const defaults=object(raw.por_defecto,'por_defecto',['peso','timeout'])
      field(defaults,'peso','por_defecto','number');field(defaults,'timeout','por_defecto','string')
    }
    for(const [i,value] of array(raw.grupos,'grupos').entries()) {
      const path=`grupos[${i+1}]`
      const group=object(value,path,['grupo','comprobaciones']);field(group,'grupo',path,'string')
      for(const [j,value] of array(group.comprobaciones,`${path}.comprobaciones`).entries()) {
        const at=`${path}.comprobaciones[${j+1}]`
        const c=object(value,at,['id','descripcion','en','cmd','fichero','valor','peso','timeout',...ASSERTIONS])
        for(const key of ['id','descripcion','en','fichero','valor','timeout','contiene','igual_a','no_contiene']) field(c,key,at,'string')
        field(c,'peso',at,'number');field(c,'exit_code',at,'integer')
        for(const arg of array(c.cmd,`${at}.cmd`)) if(typeof arg!=='string') throw new Error(`${at}.cmd: cada argumento debe ser texto.`)
        if(ASSERTIONS.filter(key=>c[key]!==undefined).length!==1) throw new Error(`${at}: debe tener exactamente una aserción.`)
        if(c.cmd!==undefined && c.valor!==undefined) throw new Error(`${at}: cmd y valor no pueden aparecer juntos.`)
        if(c.fichero!==undefined && (c.cmd!==undefined || c.valor!==undefined)) throw new Error(`${at}: fichero, cmd y valor no pueden aparecer juntos.`)
        if(c.fichero!==undefined && c.exit_code!==undefined) throw new Error(`${at}: exit_code requiere un comando.`)
        if(c.cerca_de!==undefined) {
          const near=object(c.cerca_de,`${at}.cerca_de`,['ancla','lineas','contiene'])
          field(near,'ancla',`${at}.cerca_de`,'string');field(near,'contiene',`${at}.cerca_de`,'string');field(near,'lineas',`${at}.cerca_de`,'integer')
        }
      }
    }
    return null
  } catch(error) { return error instanceof Error ? error.message : String(error) }
}

/**
 * Reads an exam from its YAML.
 *
 * What it does not understand is NOT dropped silently: an exam it cannot read
 * is reported, and the editor then leaves the YAML view as the only way in,
 * so nothing the teacher wrote is quietly thrown away (principio 2).
 */
export function readExam(yaml: string): { exam: Exam } | { problem: string } {
  let doc: unknown
  try {
    doc = load(yaml)
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) }
  }
  if (!doc || typeof doc !== 'object') return { problem: 'El examen está vacío.' }
  const problem=formatProblem(doc)
  if(problem) return {problem}
  const raw = doc as Record<string, unknown>
  const defaults = (raw.por_defecto ?? {}) as Record<string, unknown>
  const groups = Array.isArray(raw.grupos) ? raw.grupos : []
  return {
    exam: {
      examen: text(raw.examen),
      version: typeof raw.version === 'number' ? raw.version : 1,
      hosts: Array.isArray(raw.hosts) ? raw.hosts.map(text).filter(Boolean) : [],
      porDefecto: { peso: text(defaults.peso), timeout: text(defaults.timeout) },
      grupos: groups.map((group) => {
        const g = (group ?? {}) as Record<string, unknown>
        return {
          grupo: text(g.grupo),
          comprobaciones: Array.isArray(g.comprobaciones) ? g.comprobaciones.map(readCheck) : []
        }
      })
    }
  }
}

/**
 * The fields that really are numbers: a weight, an exit code, a count of
 * lines. Everything else stays a quoted string, because an expected value of
 * `yes` or `on` read as YAML is a boolean, and the check would then compare
 * the output against `true`.
 */
function weight(value: string): number | string {
 const clean=value.trim()
 const numeric=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(clean) ? Number(clean) : NaN
 return Number.isFinite(numeric) ? numeric : clean
}

function count(value: string): number | string {
  const clean = value.trim()
  return /^-?\d+$/.test(clean) ? Number(clean) : clean
}

function writeCheck(check: Check): Record<string, unknown> {
  const out: Record<string, unknown> = { id: check.id, descripcion: check.descripcion }
  if (check.fichero !== undefined) {
    if (check.en) out.en = check.en
    if (check.peso.trim()) out.peso = weight(check.peso)
    out.fichero = check.fichero
  } else if (check.cmd.length > 0) {
    if (check.en) out.en = check.en
    if (check.peso.trim()) out.peso = weight(check.peso)
    if (check.timeout.trim()) out.timeout = check.timeout.trim()
    out.cmd = check.cmd
  } else {
    if (check.peso.trim()) out.peso = weight(check.peso)
    out.valor = check.valor
  }
  if (check.timeout.trim()) out.timeout=check.timeout.trim()
  const { kind, value, anchor, lines } = check.assertion
  if (kind === 'cerca_de') {
    out.cerca_de = { ancla: anchor ?? '', lineas: count(lines ?? ''), contiene: value }
  } else {
    out[kind] = kind === 'exit_code' ? count(value) : value
  }
  return out
}

/**
 * The YAML of this exam, the way the teacher would have written it.
 *
 * The keys keep the order of the format's example, because that is the order
 * they are read in: what the check is called, then what it runs, then what is
 * expected of it. An alphabetical dump would be legal YAML and unreadable.
 */
export function examYaml(exam: Exam): string {
  const doc: Record<string, unknown> = {
    examen: exam.examen,
    version: exam.version,
    hosts: exam.hosts
  }
  const defaults: Record<string, unknown> = {}
  if (exam.porDefecto.peso.trim()) defaults.peso = weight(exam.porDefecto.peso)
  if (exam.porDefecto.timeout.trim()) defaults.timeout = exam.porDefecto.timeout.trim()
  if (Object.keys(defaults).length > 0) doc.por_defecto = defaults
  doc.grupos = exam.grupos.map((group) => ({
    grupo: group.grupo,
    comprobaciones: group.comprobaciones.map(writeCheck)
  }))
  // Every string is quoted on purpose. An expected value of `yes`, `on` or
  // `no` written bare is a boolean in YAML, and the check would compare the
  // student's output against `true`.
  return dump(doc, { lineWidth: 100, noRefs: true, quotingType: '"', forceQuotes: true })
}

/** The total weight of the exam, the denominator every student shares. */
export function totalWeight(exam: Exam): number {
  const fallback = Number(exam.porDefecto.peso.trim() || '1')
  let total = 0
  for (const group of exam.grupos) {
    for (const check of group.comprobaciones) {
      const own = Number(check.peso.trim())
      total += Number.isFinite(own) && check.peso.trim() !== '' ? own : fallback
    }
  }
  return total
}

export function checkCount(exam: Exam): number {
  return exam.grupos.reduce((count, group) => count + group.comprobaciones.length, 0)
}

/**
 * What is wrong with a check before the engine ever sees it, in the teacher's
 * words, or null.
 *
 * This is not a second validator: the engine is the one that decides, and its
 * message is what ends up on screen. This only stops the obvious from
 * becoming a round trip.
 */
export function checkProblem(check: Check, exam: Exam, others: Check[]): string | null {
  if (!check.id.trim()) return 'La comprobación necesita un identificador.'
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(check.id.trim())) {
    return 'El identificador lleva minúsculas, números, guion y guion bajo. Por ejemplo «dns-activo».'
  }
  if (others.some((other) => other !== check && other.id.trim() === check.id.trim())) {
    return `Ya hay una comprobación que se llama «${check.id.trim()}».`
  }
  if (!check.descripcion.trim()) return 'La comprobación necesita una descripción.'
  const hasFile = check.fichero !== undefined
  if (hasFile && (check.cmd.length > 0 || check.valor !== '')) return 'Elige solo una fuente: comando, fichero o valor del inventario.'
  if (!hasFile && check.cmd.length === 0 && !check.valor.trim()) {
    return 'Pon un comando, un fichero o un valor del alumno que comparar.'
  }
  if (hasFile && (!check.fichero?.trim() || check.fichero.includes('\0') || (!check.fichero.startsWith('/') && !check.fichero.startsWith('${')))) {
    return 'La ruta del fichero debe ser absoluta, no vacía y sin caracteres nulos.'
  }
  if (check.cmd.length > 0 || hasFile) {
    if (!check.en.trim()) return 'Di en qué máquina se ejecuta.'
    if (!exam.hosts.includes(check.en.trim())) {
      return `El examen no declara la máquina «${check.en.trim()}».`
    }
  }
  const { kind, value, anchor, lines } = check.assertion
  if (kind === 'exit_code') {
    if (hasFile) return 'El código de salida requiere un comando; el fichero comprueba contenido.'
    if (!/^\d+$/.test(value.trim())) return 'El código de salida es un número, por ejemplo 0.'
  } else if (!value.trim()) {
    return 'Di qué se espera encontrar.'
  }
  if (kind === 'cerca_de') {
    if (!anchor?.trim()) return 'La búsqueda por cercanía necesita una línea de anclaje.'
    if (!/^\d+$/.test((lines ?? '').trim())) {
      return 'Di cuántas líneas después del anclaje se miran.'
    }
  }
  if (check.peso.trim() && (typeof weight(check.peso)!=='number' || Number(check.peso)<0)) {
    return 'El peso debe ser un número finito mayor o igual que cero.'
  }
  if (check.timeout.trim() && !/^\d+(s|m|h)$/.test(check.timeout.trim())) {
    return 'El tiempo máximo se escribe como «20s», «2m» o «1h».'
  }
  return null
}

/** Every check of the exam, in order. */
export function allChecks(exam: Exam): Check[] {
  return exam.grupos.flatMap((group) => group.comprobaciones)
}

/**
 * The command as one line, for reading, and back.
 *
 * The vector is what the engine gets and what makes injection impossible, but
 * nobody types a YAML list by hand. A quoted piece stays whole, so a path
 * with a space in it survives the round trip.
 */
export function commandLine(cmd: string[]): string {
  return cmd.map((arg) => (/[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg)).join(' ')
}

export function readCommandLine(line: string): string[] {
  const args: string[] = []
  let current = ''
  let quoted = false
  let started = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '\\' && quoted && line[i + 1] === '"') {
      current += '"'
      i++
    } else if (c === '"') {
      quoted = !quoted
      started = true
    } else if (/\s/.test(c) && !quoted) {
      if (started) args.push(current)
      current = ''
      started = false
    } else {
      current += c
      started = true
    }
  }
  if (started) args.push(current)
  return args
}
