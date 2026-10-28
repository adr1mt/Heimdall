import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ExamRecord } from '../shared/exam-record'
import type { Delivery } from '../shared/types'
import type { Scale } from '../renderer/src/lib/scale'
import { scaleOf } from '../renderer/src/lib/scale'
import { studentReport } from '../renderer/src/lib/report'
import { readArtifact } from './artifact'
import { deliverReports } from './deliver'
import { ExamRecords, digest } from './exam-record'
import { secretRefsIn } from './secrets'

/** One authoritative origin per student; never a synthetic last-round report. */
export async function sendFinalReports(records: ExamRecords, record: ExamRecord, engine: string, password: string, scale: Scale): Promise<Delivery> {
  if (record.state !== 'FINALIZED') throw new Error('Finaliza el examen antes de enviar informes definitivos.')
  const { session } = await records.view(record)
  if (!session) throw new Error('No hay vueltas evaluadas para generar informes finales.')
  const file = `informe-final-${record.id}.html`
  record.reportScale ??= { id: scale.id, passMark: record.passMark }
  const fixedScale = scaleOf(record.reportScale.id, record.reportScale.passMark)
  records.save(record)
  const result: Delivery = { file, students: [] }
  const dir = records.directory(record)
  const exam = readFileSync(join(dir, 'examen.yaml'), 'utf8')
  const inventory = readFileSync(join(dir, record.inventoryName), 'utf8')
  if (digest(exam) !== record.examHash || digest(inventory) !== record.inventoryHash) throw new Error('Las definiciones conservadas de la sesión han cambiado.')
  const groups = new Map<number, Record<string, string>>()
  for (const student of session.students) {
    if (student.from_round === 0) {
      result.students.push({ student_id: student.student_id, name: student.name, delivered: false, reason: student.reason || 'Sin nota final: ninguna vuelta con evaluación completa.' })
      continue
    }
    if (record.delivery[student.student_id]?.state === 'SENT') {
      result.students.push({ student_id: student.student_id, name: student.name, delivered: true })
      continue
    }
    const pages = groups.get(student.from_round) ?? {}
    // Each group is sent with the artifact containing its own evidence and
    // SSH identity; the existing engine still owns concurrency and privacy.
    groups.set(student.from_round, pages)
    pages[student.student_id] = ''
  }
  for (const [round, pages] of groups) {
    const origin = record.rounds[round - 1], run = readArtifact(origin.path)
    for (const id of Object.keys(pages)) {
      const best = session.students.find(s => s.student_id === id)!
      const evidence = run.students.find(s => s.student_id === id)
      if (!evidence || evidence.score.status !== 'COMPLETE' || run.run_id !== best.from_run_id) throw new Error('No se encuentra la vuelta de la nota final del alumno.')
      pages[id] = studentReport(run, evidence, fixedScale, record.title, round)
      record.delivery[id] = { state: 'SENDING', at: new Date().toISOString() }
    }
    records.save(record)
    let recipients: Delivery['students']
    try {
      const secrets = Object.fromEntries(secretRefsIn(inventory).map(ref => [ref, password]))
      const answer = await deliverReports(engine, origin.path, file, secrets, pages, dir)
      recipients = Object.keys(pages).map(id => answer.students.find(s => s.student_id === id) ?? { student_id: id, name: session.students.find(s => s.student_id === id)!.name, delivered: false, reason: 'El motor no confirmó la entrega.' })
    } catch (error) {
      recipients = Object.keys(pages).map(id => ({ student_id: id, name: session.students.find(s => s.student_id === id)!.name, delivered: false, reason: error instanceof Error ? error.message : String(error) }))
    }
    for (const recipient of recipients) {
      record.delivery[recipient.student_id] = { state: recipient.delivered ? 'SENT' : 'FAILED', at: new Date().toISOString(), ...(recipient.reason ? { reason: recipient.reason } : {}) }
      result.students.push(recipient)
    }
    records.save(record)
  }
  return result
}
