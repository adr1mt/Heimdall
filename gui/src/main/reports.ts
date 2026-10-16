import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

/**
 * Writes the students' reports into a new folder inside the one the teacher
 * chose (T185). The renderer built every page; here nothing is computed.
 *
 * The folder is always new: a second batch of the same correction lands next
 * to the first one instead of over it, so a report already handed out is
 * never replaced without the teacher noticing. Returns the folder written.
 */
export function writeReports(parent: string, folder: unknown, files: unknown): string {
  if (!Array.isArray(files) || files.length === 0) throw new Error('No hay ningún informe que guardar.')
  const pages = files.map((file) => {
    const { name, html } = (file ?? {}) as { name?: unknown; html?: unknown }
    const safe = typeof name === 'string' ? basename(name.trim()) : ''
    if (!/^[^.].*\.html$/.test(safe) || typeof html !== 'string') throw new Error('Un informe no tiene nombre o contenido válidos.')
    return { name: safe, html }
  })
  if (new Set(pages.map((page) => page.name)).size !== pages.length) throw new Error('Dos informes tienen el mismo nombre.')
  const base = typeof folder === 'string' && basename(folder.trim()) ? basename(folder.trim()) : 'informes'
  let dir = join(parent, base)
  for (let n = 2; existsSync(dir); n++) dir = join(parent, `${base}-${n}`)
  mkdirSync(dir)
  for (const page of pages) writeFileSync(join(dir, page.name), page.html, { encoding: 'utf-8', flag: 'wx' })
  return dir
}
