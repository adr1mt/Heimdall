import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import type { ExamDescription } from '../shared/describe'

/**
 * The name the teacher gave an exam, read from the file itself.
 *
 * It is a reading for the screen and nothing else: a path is what a computer
 * needs and a name is what the teacher chose, and «/tmp/…/examen.yaml» in
 * front of a class says nothing about which exam is being corrected. The
 * engine still validates the file; an unreadable one gets no name here and
 * its error, whole, when the correction starts.
 */
function read(path: string): Record<string, unknown> | null {
  try {
    const value = load(readFileSync(path, 'utf-8'))
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

export function describeExam(path: string): ExamDescription | null {
  const doc = read(path)
  if (!doc) return null
  const groups = Array.isArray(doc.grupos) ? doc.grupos : []
  let checks = 0
  for (const group of groups) {
    const list = (group as Record<string, unknown>)?.comprobaciones
    if (Array.isArray(list)) checks += list.length
  }
  return { name: text(doc.examen), checks: groups.length > 0 ? checks : null }
}
