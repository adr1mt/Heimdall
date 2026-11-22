import { execFile } from 'node:child_process'
import { chmod, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { ExamRecord, ReportExport } from '../shared/exam-record'
import { scaleOf } from '../renderer/src/lib/scale'
import { escapeReportText, studentReport } from '../renderer/src/lib/report'
import { readArtifactSnapshot } from './artifact'
import { digest } from './exam-record'

function filenamePart(value: string): string {
  const safe = value.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^\.+/, '')
  return Array.from(safe).slice(0, 24).join('') || 'informe'
}

function issue(student: { id: string; name: string }, reason: string): string {
  return `${student.name} (${student.id}) · ${reason}`
}

/** Moodle's individual submission folders carry the assignment-specific participant number. */
export async function participantsFromFolder(folder: string) {
  const participants = new Map<string, string>()
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const match = /^([^_]+)_([1-9]\d*)_assignsubmission_\w+?_?$/.exec(entry.name)
    if (!match) continue
    if (participants.has(match[2]) && participants.get(match[2]) !== match[1]) throw new Error('Hay varios nombres para el mismo participante.')
    participants.set(match[2], match[1])
  }
  if (!participants.size) throw new Error('Selecciona la carpeta descomprimida que contiene las carpetas individuales de participantes de Moodle.')
  return Array.from(participants, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export async function exportReports(record: ExamRecord, destination: string, scaleId: string,
  mapping?: Record<string, string>, password?: string): Promise<ReportExport> {
  if (record.state !== 'FINALIZED' || !Array.isArray(record.finalOrigins)) throw new Error('Selecciona una sesión finalizada.')
  const origins = new Map(record.finalOrigins.map(s => [s.studentId, s.runId]))
  if (mapping !== undefined) {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new Error('Asignación de participantes inválida.')
    const ids = Object.values(mapping)
    if (!ids.length || new Set(ids).size !== ids.length || Object.entries(mapping).some(([key, id]) =>
      !origins.get(key) || typeof id !== 'string' || !/^[1-9]\d{0,15}$/.test(id))) throw new Error('Revisa los participantes asignados antes de crear el ZIP.')
  }
  const scale = scaleOf(record.reportScale?.id ?? scaleId, record.passMark)
  const result: ReportExport = { written: 0, issues: [], folder: null }
  const date = (record.closedAt ?? record.createdAt).slice(0, 10)
  const prefix = [record.title, record.className, date].map(filenamePart).join('-')
  const folder = await mkdtemp(join(destination, prefix + '-'))
  const pages = mapping ? join(folder, 'html') : folder
  try {
    if (mapping) await mkdir(pages, { mode: 0o700 })
    const remaining = new Map(record.roster.map(s => [s.id, s]))
    const files: string[] = []
    for (const [index, round] of record.rounds.entries()) {
      const students = record.roster.filter(s => origins.get(s.id) === round.runId)
      if (!students.length) continue
      let snapshot
      try {
        snapshot = readArtifactSnapshot(round.path)
        if (digest(snapshot.text) !== round.sha256 || snapshot.run.run_id !== round.runId) throw new Error('La corrección guardada ha cambiado.')
      } catch (error) {
        for (const s of students) {
          remaining.delete(s.id)
          result.issues.push(issue(s, error instanceof Error ? error.message : String(error)))
        }
        continue
      }
      for (const student of students) {
        remaining.delete(student.id)
        const evidence = snapshot.run.students.find(s => s.student_id === student.id)
        if (evidence?.score.status !== 'COMPLETE') {
          result.issues.push(issue(student, 'Falta la corrección completa.'))
          continue
        }
        if (mapping && !Object.hasOwn(mapping, student.id)) {
          result.issues.push(issue(student, 'Sin participante asignado.'))
          continue
        }
        const html = studentReport(snapshot.run, evidence, scale, record.title, index + 1)
        if (password && (html.includes(password) || html.includes(escapeReportText(password)))) {
          result.issues.push(issue(student, 'El informe contiene una credencial de clase.'))
          continue
        }
        const base = filenamePart(student.id)
        let file = mapping ? 'Alumno_' + mapping[student.id] + '_assignfeedback_file_informe.html' : base + '.html'
        for (let n = 2; files.includes(file); n++) file = base + '-' + n + '.html'
        await writeFile(join(pages, file), html, { mode: 0o600, flag: 'wx' })
        files.push(file)
      }
    }
    for (const student of remaining.values()) {
      result.issues.push(issue(student, origins.get(student.id) ? 'Falta la vuelta de la nota final.' : 'Sin nota final.'))
    }
    if (!files.length) return result
    if (mapping) {
      // Python's standard zipfile is available on the supported Linux desktop.
      await promisify(execFile)('/usr/bin/python3', ['-I', '-m', 'zipfile', '-c', '../feedback.zip', ...files], { cwd: pages })
      await chmod(join(folder, 'feedback.zip'), 0o600)
      await rm(pages, { recursive: true })
    }
    result.folder = folder
    result.written = files.length
    return result
  } finally {
    if (!result.folder) await rm(folder, { recursive: true, force: true })
  }
}
