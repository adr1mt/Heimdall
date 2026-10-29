// Real native engine + real disk; synthetic students, no SSH and no user data.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { ExamRecords, digest } from '../src/main/exam-record'
import { validRun } from '../tests/fixtures/valid-run'
import { aulaFileName, aulaYaml } from '../src/shared/aula'
import type { ClassGroup } from '../src/shared/classes'
import { sessionCsv, sessionGradeRows, moodleCsv, moodleRows } from '../src/renderer/src/lib/export'
import { SCALES, toScale } from '../src/renderer/src/lib/scale'
import { sessionGrade } from '../src/renderer/src/lib/session-grade'
import { studentReport } from '../src/renderer/src/lib/report'

const root = mkdtempSync(join(tmpdir(), 'heimdall-native-session-'))
const engine = resolve('../bin/heimdall'), exam = join(root, 'examen.yaml'), data = join(root, 'data')
writeFileSync(exam, 'examen: Ficticio\n')
mkdirSync(join(root, 'var'))
const group: ClassGroup = { id: 'fiction', name: 'Ficticia', password: 'never-copy-this', columns: [],
  students: ['first', 'second', 'missing'].map(id => ({ id, name: `Ficticio ${id}`, contact: `${id}@example.invalid`, user: 'alumno', host: '192.0.2.1', port: '22', fields: {} })) }
const records = new ExamRecords(data, engine), record = records.prepare(exam, group)
function round(number: number, points: number[]) {
  const run = validRun(), base = run.students[0]
  const at = `2026-10-28T10:0${number}:00Z`
  run.run_id = `R${number}`; run.started_at = at; run.finished_at = at
  run.exam = { path: exam, sha256: digest(readFileSync(exam)) }
  run.inventory = { path: join(root, aulaFileName(group)), sha256: digest(aulaYaml(group)) }
  run.plan = { ...run.plan, check_count: 50, total_weight: 50, check_ids: Array.from({ length: 50 }, (_, i) => `c${i}`) }
  run.students = group.students.map((student, index) => {
    const obtained = points[index], missing = obtained < 0
    return { ...base, student_id: student.id, name: student.name, moodle_id: student.contact, started_at: at, finished_at: at,
      status: missing ? 'NOT_EVALUATED' : 'OK',
      score: { obtained: missing ? 0 : obtained, evaluable: missing ? 0 : 50, total: 50, unevaluated: missing ? 50 : 0,
        status: missing ? 'NOT_EVALUATED' : 'COMPLETE', final_score: missing ? null : obtained * 2, provisional_score: missing ? null : obtained * 2 },
      checks: run.plan.check_ids.map((id, i) => ({ ...base.checks[0], check_id: id,
        status: missing ? 'UNEVALUATED' : i < obtained ? 'PASS' : 'FAIL', cause: missing ? 'CONNECT_FAILED' : 'NONE',
        execution: missing ? null : { ...base.checks[0].execution!, started_at: at },
        assertion: missing ? null : { ...base.checks[0].assertion!, matched: i < obtained, found: i < obtained ? 'yes' : 'no' } })) }
  })
  run.status = 'PARTIAL'
  const path = join(root, 'var', `run-R${number}.json`)
  writeFileSync(path, JSON.stringify(run)); return { path, run }
}
records.begin(record)
const first = round(1, [50, 25, -1]); records.append(record, first.path); records.recover(record)
records.begin(record)
const last = round(2, [41, 45, -1])
// Simulate a hard process death after the canonical file was committed.
const reopened = new ExamRecords(data, engine), restored = reopened.get(exam, group.id)!
reopened.recover(restored)
reopened.pause(restored)
const pausedAfterRestart = new ExamRecords(data, engine).get(exam, group.id)!
assert.equal(pausedAfterRestart.state, 'PAUSED')
assert.equal(pausedAfterRestart.closedAt, undefined)
const resumed = reopened.prepare(exam, group)
assert.equal(resumed.id, record.id)
assert.equal(resumed.rounds.length, 2)
reopened.begin(resumed)
const offline = round(3, [-1, 40, -1])
reopened.append(resumed, offline.path); reopened.recover(resumed)
assert.equal(offline.run.students[0].score.final_score, null)
const final = await reopened.finalize(resumed)
assert.equal(final.record.state, 'FINALIZED')
assert.deepEqual(final.session!.students.map(student => [student.student_id, student.score.final_score, student.from_round]), [['first',100,1],['second',90,2],['missing',null,0]])
assert.equal(sessionGrade(last.run.students[0], final).student.score.final_score, 100)
assert.equal(last.run.students[0].score.final_score, 82)
assert.equal(toScale(last.run.students[0].score.final_score!, SCALES.ten), '7,0')
const csv = sessionCsv(final.session!, SCALES.ten)
assert.ok(csv.includes('10,0')); assert.ok(csv.includes('8,3'))
const moodle = moodleCsv(moodleRows(sessionGradeRows(final.session!, SCALES.ten)))
assert.ok(moodle.includes('first@example.invalid;10,0')); assert.ok(moodle.includes('missing@example.invalid;\r\n'))
const report = studentReport(first.run, first.run.students[0], SCALES.ten, final.record.title, 1)
assert.ok(report.includes('Informe final')); assert.ok(report.includes('Vuelta 1'))
assert.ok(!report.includes('Ficticio second')); assert.ok(!report.includes(group.password))
const afterRestart = await new ExamRecords(data, engine).view(new ExamRecords(data, engine).get(exam, group.id)!)
assert.equal(afterRestart.session!.students[0].score.final_score, 100)
assert.equal(afterRestart.record.closedAt, final.record.closedAt)
writeFileSync(exam, 'examen: Otros criterios\n')
const next = reopened.prepare(exam, group)
assert.notEqual(next.id, record.id); assert.equal(next.rounds.length, 0)
assert.equal(reopened.list(exam, group.id).length, 2)
assert.equal(readFileSync(first.path, 'utf8'), JSON.stringify(first.run))
console.log(JSON.stringify({ root, finalGrades: afterRestart.session!.students.map(s => ({ student: s.student_id, score: s.score.final_score, round: s.from_round })), closedAt: final.record.closedAt, nativeEngine: engine, csv: 'verified', moodle: 'verified', recovery: 'verified', preservedTenAfterSeven: true, preservedBestAfterSshFailure: true, pausedRestartAndResume: true, historicalBytes: 'unchanged' }, null, 2))

export { root, engine, group, final }
