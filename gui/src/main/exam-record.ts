import { createHash, randomUUID } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { load } from 'js-yaml'
import { readArtifactSnapshot } from './artifact'
import { readExamSession } from './session'
import type { ExamRecord, SavedExam } from '../shared/exam-record'
import type { ClassGroup } from '../shared/classes'
import { aulaFileName, aulaYaml } from '../shared/aula'
import { RUN_FILE, varDirOf } from './history'

export function digest(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Rename plus file/directory fsync: success means durable, never a partial JSON. */
export function durableWrite(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const tmp = `${path}.${randomUUID()}.tmp`
  try {
    const fd = openSync(tmp, 'wx', 0o600)
    try { writeFileSync(fd, text); fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(tmp, path)
    const dir = openSync(dirname(path), 'r')
    try { fsyncSync(dir) } finally { closeSync(dir) }
  } finally { if (existsSync(tmp)) unlinkSync(tmp) }
}

/** Only provenance and lifecycle are stored. All grades/evidence come from artifacts. */
export class ExamRecords {
  constructor(private dataDir: string, private engine: string) {}

  private root(examPath: string, classId: string): string {
    return join(this.dataDir, 'exam-sessions', digest(JSON.stringify([resolve(examPath), classId])))
  }

  directory(record: ExamRecord): string {
    if (!/^[a-f0-9-]{36}$/.test(record.id)) throw new Error('Identificador de sesión inválido.')
    return join(this.root(record.examPath, record.classId), record.id)
  }

  save(record: ExamRecord): void {
    durableWrite(join(this.directory(record), 'session.json'), JSON.stringify(record))
  }

  list(examPath: string, classId: string): ExamRecord[] {
    const root = this.root(examPath, classId)
    if (!existsSync(root)) return []
    return readdirSync(root).filter(id => /^[a-f0-9-]{36}$/.test(id)).map(id => {
      const raw = JSON.parse(readFileSync(join(root, id, 'session.json'), 'utf8')) as ExamRecord
      if (raw.version !== 1 || raw.id !== id || raw.examPath !== resolve(examPath) || raw.classId !== classId || !Array.isArray(raw.rounds) || !raw.delivery || !['ACTIVE', 'FINALIZING', 'FINALIZED'].includes(raw.state)) {
        throw new Error('El registro de la sesión está dañado. No se han sustituido sus notas.')
      }
      return raw
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  }

  get(examPath: string, classId: string, id?: string): ExamRecord | null {
    const records = this.list(examPath, classId)
    const record = id ? records.find(r => r.id === id) : records[0]
    if (id && !record) throw new Error('No se encuentra la sesión solicitada.')
    return record ?? null
  }

  prepare(examPath: string, group: ClassGroup, fresh = false, passMark = 70): ExamRecord {
    if (basename(aulaFileName(group)) !== aulaFileName(group)) throw new Error('Identificador de clase inválido.')
    const exam = readFileSync(examPath, 'utf8'), inventory = aulaYaml(group)
    const previous = this.get(examPath, group.id)
    if (previous?.pending) this.recover(previous)
    if (previous?.state === 'FINALIZING') throw new Error('La sesión se está finalizando. No se pueden iniciar más vueltas.')
    if (!fresh && previous?.state === 'ACTIVE' && previous.examHash === digest(exam) && previous.inventoryHash === digest(inventory) && previous.passMark === passMark) return previous
    const parsed = load(exam) as { examen?: string } | null
    const record: ExamRecord = {
      version: 1, id: randomUUID(), examPath: resolve(examPath), classId: group.id, className: group.name,
      roster: group.students.map(student => ({ id: student.id, name: student.name, moodleId: student.contact })),
      title: typeof parsed?.examen === 'string' && parsed.examen.trim() ? parsed.examen : basename(dirname(examPath)), createdAt: new Date(Math.max(Date.now(), previous ? Date.parse(previous.createdAt) + 1 : 0)).toISOString(), state: 'ACTIVE',
      passMark, examHash: digest(exam), inventoryHash: digest(inventory), inventoryName: aulaFileName(group), rounds: [], delivery: {}
    }
    // Save non-secret definitions once, for reproducible final delivery after edits.
    const dir = this.directory(record), parent = dirname(dir)
    const stage = join(parent, `.stage-${record.id}`)
    try {
      durableWrite(join(stage, 'examen.yaml'), exam)
      durableWrite(join(stage, record.inventoryName), inventory)
      durableWrite(join(stage, 'session.json'), JSON.stringify(record))
      renameSync(stage, dir)
      const fd = openSync(parent, 'r')
      try { fsyncSync(fd) } finally { closeSync(fd) }
    } finally { rmSync(stage, { recursive: true, force: true }) }
    return record
  }

  begin(record: ExamRecord): void {
    if (record.state !== 'ACTIVE' || record.pending) throw new Error('La sesión no acepta otra vuelta.')
    record.pending = { before: this.artifacts(record) }
    this.save(record)
  }

  private artifacts(record: ExamRecord): string[] {
    const dir = varDirOf(record.examPath)
    return existsSync(dir) ? readdirSync(dir).filter(name => RUN_FILE.test(name)) : []
  }

  append(record: ExamRecord, path: string): void {
    if (record.state === 'FINALIZED') throw new Error('El examen ya está finalizado.')
    const { run, text } = readArtifactSnapshot(path)
    if (record.rounds.some(round => round.runId === run.run_id)) return
    if (resolve(run.exam.path) !== record.examPath || basename(run.inventory.path) !== record.inventoryName || run.exam.sha256 !== record.examHash || run.inventory.sha256 !== record.inventoryHash || (record.planHash && record.planHash !== run.plan_hash)) {
      throw new Error('La corrección usa otros criterios o clase. No se han mezclado sus notas.')
    }
    record.planHash = run.plan_hash
    record.rounds.push({ path: resolve(path), runId: run.run_id, sha256: digest(text) })
    this.save(record)
  }

  /** A committed artifact survives even when run.end never reached Electron. */
  recover(record: ExamRecord): void {
    if (!record.pending) return
    const before = new Set(record.pending.before)
    for (const name of this.artifacts(record).filter(name => !before.has(name)).sort()) {
      this.append(record, join(varDirOf(record.examPath), name))
    }
    delete record.pending
    this.save(record)
  }

  async view(record: ExamRecord): Promise<SavedExam> {
    for (const round of record.rounds) {
      const { run, text } = readArtifactSnapshot(round.path)
      if (run.run_id !== round.runId || digest(text) !== round.sha256) throw new Error('Un resultado histórico ha cambiado. No se pueden reconstruir las notas con seguridad.')
    }
    const session = record.rounds.length ? await readExamSession(this.engine, record.rounds.map(round => round.path)) : null
    if (record.state === 'FINALIZED' && session && JSON.stringify(this.origins(session)) !== JSON.stringify(record.finalOrigins)) {
      throw new Error('La reconstrucción no coincide con las notas finales guardadas.')
    }
    return { record, session }
  }

  private origins(session: NonNullable<SavedExam['session']>): NonNullable<ExamRecord['finalOrigins']> {
    return session.students.map(student => ({ studentId: student.student_id, ...(student.from_run_id ? { runId: student.from_run_id } : {}) }))
  }

  async finalize(record: ExamRecord): Promise<SavedExam> {
    if (record.state === 'FINALIZED') return this.view(record)
    record.state = 'FINALIZING'
    this.save(record)
    this.recover(record)
    const view = await this.view(record)
    record.finalOrigins = view.session ? this.origins(view.session) : []
    record.state = 'FINALIZED'
    record.closedAt = new Date().toISOString()
    this.save(record)
    return { ...view, record }
  }
}
