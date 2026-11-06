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
export type AssertionKind = 'contains' | 'equals' | 'not_contains' | 'exit_code' | 'near'

export const ASSERTIONS: AssertionKind[] = [
  'contains',
  'equals',
  'not_contains',
  'exit_code',
  'near'
]

export interface Assertion {
  kind: AssertionKind
  /** What is expected: the substring, the whole output, the exit code. */
  value: string
  /** `near` only: the line the search starts from. */
  anchor?: string
  /** `near` only: how many lines after the anchor are looked at. */
  lines?: string
}

export interface Check {
  id: string
  description: string
  /** Logical host the command runs on. Empty for a `value:` check. */
  on: string
  /** The command, as a vector of arguments. There is no shell, ever. */
  cmd: string[]
  /**
   * A check with no command: the expected value is compared against a field
   * of the inventory, e.g. `${student.p1}` (M-11). Empty when there is a cmd.
   */
  value: string
  assertion: Assertion
  /** Empty means the exam's default. */
  weight: string
  timeout: string
  /** Run the command through sudo (ADR-0032). Absent means the exam's default. */
  sudo?: boolean
}

export interface Group {
  group: string
  checks: Check[]
}

export interface Exam {
  exam: string
  version: number
  hosts: string[]
  defaults: { weight: string; timeout: string; sudo?: boolean }
  groups: Group[]
}

export function emptyExam(name: string): Exam {
  return {
    exam: name,
    version: 1,
    hosts: ['host1'],
    defaults: { weight: '1', timeout: '20s' },
    groups: []
  }
}

export function emptyCheck(host: string): Check {
  return {
    id: '',
    description: '',
    on: host,
    cmd: [],
    value: '',
    assertion: { kind: 'contains', value: '' },
    weight: '',
    timeout: ''
  }
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function readAssertion(raw: Record<string, unknown>): Assertion {
  if (raw.near && typeof raw.near === 'object') {
    const near = raw.near as Record<string, unknown>
    return {
      kind: 'near',
      value: text(near.contains),
      anchor: text(near.anchor),
      lines: text(near.lines ?? 0)
    }
  }
  for (const kind of ['contains', 'equals', 'not_contains', 'exit_code'] as const) {
    if (raw[kind] !== undefined) return { kind, value: text(raw[kind]) }
  }
  return { kind: 'contains', value: '' }
}

function readCheck(value: unknown): Check {
  const raw = (value ?? {}) as Record<string, unknown>
  return {
    id: text(raw.id),
    description: text(raw.description),
    on: text(raw.on),
    cmd: Array.isArray(raw.checker)
      ? ['heimdall:checker', ...raw.checker.map(text)]
      : Array.isArray(raw.cmd) ? raw.cmd.map(text) : [],
    value: text(raw.value),
    assertion: readAssertion(raw),
    weight: text(raw.weight),
    timeout: text(raw.timeout),
    ...(typeof raw.sudo === 'boolean' ? { sudo: raw.sudo } : {})
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
  const field=(raw:Record<string,unknown>,key:string,path:string,kind:'string'|'number'|'integer'|'boolean'):void=> {
    if(raw[key]===undefined) return
    const v=raw[key]
    if(kind==='boolean') { if(typeof v!=='boolean') throw new Error(`${path}.${key}: tipo incorrecto; se esperaba true o false.`); return }
    if(typeof v!==(kind==='string'?'string':'number') || (typeof v==='number' && (!Number.isFinite(v) || (kind==='integer' && !Number.isInteger(v))))) throw new Error(`${path}.${key}: tipo incorrecto; se esperaba ${kind==='string'?'texto':'un número'}.`)
  }
  const array=(value:unknown,path:string):unknown[]=> { if(value===undefined) return []; if(!Array.isArray(value)) throw new Error(`${path}: se esperaba una lista.`);return value }
  try {
    const raw=object(doc,'exam',['exam','version','hosts','defaults','groups'])
    field(raw,'exam','exam','string');field(raw,'version','exam','integer')
    for(const host of array(raw.hosts,'hosts')) if(typeof host!=='string') throw new Error('hosts: cada máquina debe ser texto.')
    if(raw.defaults!==undefined) {
      const defaults=object(raw.defaults,'defaults',['weight','timeout','sudo'])
      field(defaults,'weight','defaults','number');field(defaults,'timeout','defaults','string');field(defaults,'sudo','defaults','boolean')
    }
    for(const [i,value] of array(raw.groups,'groups').entries()) {
      const path=`groups[${i+1}]`
      const group=object(value,path,['group','checks']);field(group,'group',path,'string')
      for(const [j,value] of array(group.checks,`${path}.checks`).entries()) {
        const at=`${path}.checks[${j+1}]`
        const c=object(value,at,['id','description','on','cmd','checker','value','weight','timeout','sudo',...ASSERTIONS])
        for(const key of ['id','description','on','value','timeout','contains','equals','not_contains']) field(c,key,at,'string')
        field(c,'weight',at,'number');field(c,'exit_code',at,'integer');field(c,'sudo',at,'boolean')
        for(const arg of array(c.cmd,`${at}.cmd`)) if(typeof arg!=='string') throw new Error(`${at}.cmd: cada argumento debe ser texto.`)
        for(const arg of array(c.checker,`${at}.checker`)) if(typeof arg!=='string') throw new Error(`${at}.checker: cada argumento debe ser texto.`)
        if(ASSERTIONS.filter(key=>c[key]!==undefined).length!==1) throw new Error(`${at}: debe tener exactamente una aserción.`)
        if(c.cmd!==undefined && c.value!==undefined) throw new Error(`${at}: cmd y value no pueden aparecer juntos.`)
        if(c.checker!==undefined && (c.cmd!==undefined || c.value!==undefined)) throw new Error(`${at}: checker no puede combinarse con cmd ni value.`)
        if(c.near!==undefined) {
          const near=object(c.near,`${at}.near`,['anchor','lines','contains'])
          field(near,'anchor',`${at}.near`,'string');field(near,'contains',`${at}.near`,'string');field(near,'lines',`${at}.near`,'integer')
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
  const defaults = (raw.defaults ?? {}) as Record<string, unknown>
  const groups = Array.isArray(raw.groups) ? raw.groups : []
  return {
    exam: {
      exam: text(raw.exam),
      version: typeof raw.version === 'number' ? raw.version : 1,
      hosts: Array.isArray(raw.hosts) ? raw.hosts.map(text).filter(Boolean) : [],
      defaults: {
        weight: text(defaults.weight),
        timeout: text(defaults.timeout),
        ...(typeof defaults.sudo === 'boolean' ? { sudo: defaults.sudo } : {})
      },
      groups: groups.map((group) => {
        const g = (group ?? {}) as Record<string, unknown>
        return {
          group: text(g.group),
          checks: Array.isArray(g.checks) ? g.checks.map(readCheck) : []
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
  const out: Record<string, unknown> = { id: check.id, description: check.description }
  if (check.cmd.length > 0) {
    if (check.on) out.on = check.on
    if (check.weight.trim()) out.weight = weight(check.weight)
    if (check.timeout.trim()) out.timeout = check.timeout.trim()
    if (check.sudo !== undefined) out.sudo = check.sudo
    if (check.cmd[0] === 'heimdall:checker') out.checker = check.cmd.slice(1)
    else out.cmd = check.cmd
  } else {
    if (check.weight.trim()) out.weight = weight(check.weight)
    out.value = check.value
    // Invalid without a command, and the engine says so: kept, never dropped.
    if (check.sudo !== undefined) out.sudo = check.sudo
  }
  if (check.timeout.trim()) out.timeout=check.timeout.trim()
  const { kind, value, anchor, lines } = check.assertion
  if (kind === 'near') {
    out.near = { anchor: anchor ?? '', lines: count(lines ?? ''), contains: value }
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
    exam: exam.exam,
    version: exam.version,
    hosts: exam.hosts
  }
  const defaults: Record<string, unknown> = {}
  if (exam.defaults.weight.trim()) defaults.weight = weight(exam.defaults.weight)
  if (exam.defaults.timeout.trim()) defaults.timeout = exam.defaults.timeout.trim()
  if (exam.defaults.sudo !== undefined) defaults.sudo = exam.defaults.sudo
  if (Object.keys(defaults).length > 0) doc.defaults = defaults
  doc.groups = exam.groups.map((group) => ({
    group: group.group,
    checks: group.checks.map(writeCheck)
  }))
  // Every string is quoted on purpose. An expected value of `yes`, `on` or
  // `no` written bare is a boolean in YAML, and the check would compare the
  // student's output against `true`.
  return dump(doc, { lineWidth: 100, noRefs: true, quoteStyle: 'double', forceQuotes: true })
}

/** The total weight of the exam, the denominator every student shares. */
export function totalWeight(exam: Exam): number {
  const fallback = Number(exam.defaults.weight.trim() || '1')
  let total = 0
  for (const group of exam.groups) {
    for (const check of group.checks) {
      const own = Number(check.weight.trim())
      total += Number.isFinite(own) && check.weight.trim() !== '' ? own : fallback
    }
  }
  return total
}

export function checkCount(exam: Exam): number {
  return exam.groups.reduce((count, group) => count + group.checks.length, 0)
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
  if (!check.description.trim()) return 'La comprobación necesita una descripción.'
  if (check.cmd.length === 0 && !check.value.trim()) {
    return 'Pon un comando, o un valor del alumno que comparar.'
  }
  if (check.cmd.length > 0) {
    if (!check.on.trim()) return 'Di en qué máquina se ejecuta.'
    if (!exam.hosts.includes(check.on.trim())) {
      return `El examen no declara la máquina «${check.on.trim()}».`
    }
  }
  const { kind, value, anchor, lines } = check.assertion
  if (kind === 'exit_code') {
    if (!/^\d+$/.test(value.trim())) return 'El código de salida es un número, por ejemplo 0.'
  } else if (!value.trim()) {
    return 'Di qué se espera encontrar.'
  }
  if (kind === 'near') {
    if (!anchor?.trim()) return 'La búsqueda por cercanía necesita una línea de anclaje.'
    if (!/^\d+$/.test((lines ?? '').trim())) {
      return 'Di cuántas líneas después del anclaje se miran.'
    }
  }
  if (check.weight.trim() && (typeof weight(check.weight)!=='number' || Number(check.weight)<0)) {
    return 'El peso debe ser un número finito mayor o igual que cero.'
  }
  if (check.timeout.trim() && !/^\d+(s|m|h)$/.test(check.timeout.trim())) {
    return 'El tiempo máximo se escribe como «20s», «2m» o «1h».'
  }
  return null
}

/** Every check of the exam, in order. */
export function allChecks(exam: Exam): Check[] {
  return exam.groups.flatMap((group) => group.checks)
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
