import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { describeExam } from './describe'
import type { OpenProject, RecentProject } from '../shared/types'

/** The exam file every project has. The engine looks for it by this name. */
export const EXAM_FILE = 'examen.yaml'

/**
 * How many projects the list keeps. A teacher works with the exams of the
 * current term; a list that never forgets is a list nobody reads.
 */
const MAX_RECENTS = 10

/**
 * Where the recent projects live (ADR-0021): one JSON file in the
 * application's own data directory, written atomically, next to the classes.
 *
 * Unlike the classes, an unreadable file here IS replaced by an empty list.
 * A recent project is a shortcut and nothing else: the exams are still on
 * disk and reopening one costs a click, so losing the list loses no work.
 */
export function projectsFile(dir: string): string {
  return join(dir, 'projects.json')
}

function readRecent(value: unknown): RecentProject | null {
  const raw = (value ?? {}) as Partial<RecentProject>
  if (typeof raw.dir !== 'string' || !raw.dir.trim()) return null
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : basename(raw.dir)
  return { dir: raw.dir, name }
}

export function readRecents(dir: string): RecentProject[] {
  try {
    const raw = JSON.parse(readFileSync(projectsFile(dir), 'utf-8')) as { recent?: unknown }
    const list = Array.isArray(raw.recent) ? raw.recent : []
    return list
      .map(readRecent)
      .filter((project): project is RecentProject => project !== null)
      .slice(0, MAX_RECENTS)
  } catch {
    return []
  }
}

export function writeRecents(dir: string, recent: RecentProject[]): void {
  const path = projectsFile(dir)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  const payload = { recent: recent.slice(0, MAX_RECENTS) }
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  renameSync(tmp, path)
}

/**
 * Puts a project at the head of the list. Opening the same one twice does not
 * make two entries, and the most recent is always the first one on screen.
 */
export function rememberProject(dir: string, project: OpenProject): RecentProject[] {
  const entry: RecentProject = { dir: project.dir, name: project.name }
  const rest = readRecents(dir).filter((other) => other.dir !== entry.dir)
  const recent = [entry, ...rest].slice(0, MAX_RECENTS)
  writeRecents(dir, recent)
  return recent
}

/** Takes a project off the list. The folder on disk is never touched. */
export function forgetProject(dir: string, target: string): RecentProject[] {
  const recent = readRecents(dir).filter((other) => other.dir !== target)
  writeRecents(dir, recent)
  return recent
}

/**
 * What a project is called, for the screen: the name the teacher wrote inside
 * the exam, and the folder's own name when the file says nothing. A path is
 * what the computer needs; a name is what gets recognised in front of a class.
 */
function nameOf(dir: string, examPath: string): string {
  return describeExam(examPath)?.name ?? basename(dir)
}

/**
 * Opens the project of a folder. The exam is resolved from the folder —it has
 * a fixed name inside it— so no file is ever chosen by hand.
 */
export function openProjectAt(dir: string): OpenProject {
  const root = resolve(dir)
  const examPath = join(root, EXAM_FILE)
  if (!existsSync(examPath)) {
    throw new Error(
      `En «${basename(root)}» no hay ningún examen: falta el fichero «${EXAM_FILE}». Con «Nuevo» se crea uno.`
    )
  }
  return { dir: root, name: nameOf(root, examPath), examPath }
}

/**
 * The exam a new project starts with: one real check, so it can be corrected
 * from the first minute and the teacher sees the whole circuit work before
 * writing anything of their own.
 */
function starterExam(name: string): string {
  return [
    `examen: "${name.replace(/"/g, "'")}"`,
    'version: 1',
    'hosts: [host1]',
    'por_defecto: { peso: 1, timeout: 20s }',
    'grupos:',
    '  - grupo: "Primeras comprobaciones"',
    '    comprobaciones:',
    '      - id: responde',
    '        descripcion: "La máquina responde y se identifica"',
    '        en: host1',
    '        cmd: ["hostname"]',
    '        exit_code: 0',
    ''
  ].join('\n')
}

/**
 * Creates a project in a folder. An existing exam is never overwritten: that
 * would be throwing away a term's work on a mis-click, and the folder that
 * already has one is opened with «Abrir».
 */
export function createProjectAt(dir: string): OpenProject {
  const root = resolve(dir)
  const examPath = join(root, EXAM_FILE)
  if (existsSync(examPath)) {
    throw new Error(
      `«${basename(root)}» ya tiene un examen. Ábrelo con «Abrir»; no se sobrescribe nada.`
    )
  }
  mkdirSync(root, { recursive: true })
  const name = basename(root)
  writeFileSync(examPath, starterExam(name), 'utf-8')
  return { dir: root, name, examPath }
}

/**
 * The folder a path stands for: the folder itself, or the one its file lives
 * in. The teacher asks for «la carpeta del examen» from a row that knows the
 * project's folder, and the same channel is asked with the exam file from
 * other screens; both mean the same place.
 *
 * Returns null when there is nothing to open, so the caller says so instead
 * of opening the file manager somewhere else.
 */
export function folderOf(path: string): string | null {
  if (typeof path !== 'string' || !path.trim()) return null
  const stat = statSync(path, { throwIfNoEntry: false })
  if (stat?.isDirectory()) return resolve(path)
  const parent = dirname(resolve(path))
  return statSync(parent, { throwIfNoEntry: false })?.isDirectory() ? parent : null
}
