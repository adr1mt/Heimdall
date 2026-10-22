import { createHash } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'

export type SourceKind = 'classes' | 'exam'
export const MAX_SOURCE_VERSIONS = 50
export const MAX_SOURCE_BYTES = 4 * 1024 * 1024
const COPY_NAME = /^\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9]{64}\.json$/
const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

export function sourceCopiesRoot(dataDir: string): string {
  return join(dataDir, 'copias-fuentes')
}

export function sourceCopiesSlot(dataDir: string, source: string, kind: SourceKind): string {
  const label = kind === 'classes' ? 'clases' : basename(dirname(source)).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 50)
  return join(sourceCopiesRoot(dataDir), `${kind}-${label}-${digest(Buffer.from(resolve(source))).slice(0, 16)}`)
}

function privateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 })
  if (!lstatSync(path).isDirectory()) throw new Error(`${path}: la carpeta de copias no puede ser un enlace`)
  chmodSync(path, 0o700)
}

/** Copies are exact bytes, bounded and verified before recovery or rotation. */
function sourceCopyBytes(dataDir: string, path: string, kind: SourceKind): Buffer {
  const root = realpathSync(sourceCopiesRoot(dataDir))
  if (!realpathSync(path).startsWith(root + sep) || !lstatSync(path).isFile()) throw new Error('La copia no pertenece al almacén privado de Heimdall.')
  const info = lstatSync(path)
  if (info.size > MAX_SOURCE_BYTES * 2 + 16384) throw new Error('La copia supera el límite de tamaño.')
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  if (raw.schema !== 1 || raw.kind !== kind || typeof raw.source !== 'string' || typeof raw.at !== 'string' || !Number.isFinite(Date.parse(raw.at)) || typeof raw.content !== 'string' || typeof raw.sha256 !== 'string') throw new Error('El formato o tipo de la copia no es válido.')
  const bytes = Buffer.from(raw.content, 'base64')
  if (bytes.length > MAX_SOURCE_BYTES || bytes.toString('base64') !== raw.content || digest(bytes) !== raw.sha256) throw new Error('La copia está dañada: su contenido no coincide con la huella.')
  return bytes
}

export function readSourceCopy(dataDir: string, path: string, kind: SourceKind): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(sourceCopyBytes(dataDir, path, kind))
}

function snapshot(dataDir: string, source: string, kind: SourceKind, bytes: Buffer): string {
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error('El fichero supera los 4 MiB admitidos para copias recuperables; no se ha reemplazado.')
  privateDirectory(dataDir)
  privateDirectory(sourceCopiesRoot(dataDir))
  const slot = sourceCopiesSlot(dataDir, source, kind)
  privateDirectory(slot)
  const hash = digest(bytes)
  const existing = readdirSync(slot).find(name => COPY_NAME.test(name) && name.endsWith(`-${hash}.json`))
  if (existing) {
    // Refuse to trust a same-named corrupt copy, rather than silently losing
    // the only valid original when it is replaced.
    sourceCopyBytes(dataDir, join(slot, existing), kind)
    return join(slot, existing)
  }
  const at = new Date().toISOString()
  const target = join(slot, `${at.replace(/[:.]/g, '-')}-${hash}.json`)
  const stage = mkdtempSync(join(slot, '.stage-'))
  try {
    const tmp = join(stage, 'version.json')
    writeFileSync(tmp, JSON.stringify({ schema: 1, kind, source: resolve(source), at, sha256: hash, content: bytes.toString('base64') }), { flag: 'wx', mode: 0o600 })
    renameSync(tmp, target)
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
  return target
}

/** Copy current and proposed versions before publishing; a failed copy aborts. */
export function writeSourceFile(dataDir: string, source: string, kind: SourceKind, text: string): void {
  if (Buffer.byteLength(text, 'utf8') > MAX_SOURCE_BYTES) throw new Error('El fichero supera los 4 MiB admitidos para copias recuperables; no se ha reemplazado.')
  const keep = new Set<string>()
  if (existsSync(source)) {
    if (lstatSync(source).size > MAX_SOURCE_BYTES) throw new Error('El original supera los 4 MiB admitidos; no se ha reemplazado.')
    if (!lstatSync(source).isFile()) throw new Error('El original no es un fichero regular; no se ha reemplazado.')
    keep.add(snapshot(dataDir, source, kind, readFileSync(source)))
  }
  keep.add(snapshot(dataDir, source, kind, Buffer.from(text, 'utf8')))
  const slot = sourceCopiesSlot(dataDir, source, kind)
  const copies = readdirSync(slot).filter(name => COPY_NAME.test(name)).sort().reverse().map(name => join(slot, name))
  // Verify before pruning: corruption must be visible and never discarded.
  for (const copy of copies) sourceCopyBytes(dataDir, copy, kind)
  let retained = keep.size
  for (const copy of copies) {
    if (keep.has(copy)) continue
    if (retained < MAX_SOURCE_VERSIONS) retained++
    else rmSync(copy)
  }
  const stage = mkdtempSync(join(dirname(source), '.heimdall-save-'))
  try {
    const tmp = join(stage, 'source')
    writeFileSync(tmp, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    renameSync(tmp, source)
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}
