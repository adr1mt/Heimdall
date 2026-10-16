import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { CheckResult, RunResult, StudentResult } from '../src/shared/artifact'
import {
  examTitleOf,
  reportFileName,
  reportsSummary,
  studentReport,
  studentReports
} from '../src/renderer/src/lib/report'
import { scaleOf } from '../src/renderer/src/lib/scale'
import { deliverArgs, deliverInput, readDelivery } from '../src/main/deliver'
import { validRun } from './fixtures/valid-run'

const POISON = 'VENENO-7f3a'
const PASSWORD = 'Contrasenya-Secreta-91'

/** A check whose every field the report must not show carries the poison. */
function check(id: string, group: string, status: CheckResult['status'], weight = 1): CheckResult {
  const base = validRun().students[0].checks[0]
  const stream = (tag: string) => ({ text: `${POISON}-${tag} ${PASSWORD}`, bytes: 10, bytes_total: 10, truncated: false })
  return {
    ...base,
    check_id: id,
    group,
    description: `Descripción ${id}`,
    weight,
    status,
    cause: status === 'UNEVALUATED' ? 'CONNECT_FAILED' : 'NONE',
    detail: `${POISON}-detail ${PASSWORD}`,
    execution:
      status === 'UNEVALUATED'
        ? null
        : {
            ...base.execution!,
            host: `${POISON}-host`,
            address: `${POISON}-address`,
            user: `${POISON}-user`,
            command: ['sh', '-c', `${POISON}-cmd ${PASSWORD}`],
            stdout: stream('stdout'),
            stderr: stream('stderr')
          },
    assertion:
      status === 'UNEVALUATED'
        ? null
        : { kind: 'contains', expected: `${POISON}-expected`, found: `${POISON}-found ${PASSWORD}`, matched: status === 'PASS' }
  }
}

function student(id: string, name: string, checks: CheckResult[]): StudentResult {
  const total = checks.reduce((sum, c) => sum + c.weight, 0)
  const obtained = checks.filter((c) => c.status === 'PASS').reduce((sum, c) => sum + c.weight, 0)
  const pending = checks.filter((c) => c.status === 'UNEVALUATED').reduce((sum, c) => sum + c.weight, 0)
  const evaluable = total - pending
  const complete = pending === 0
  return {
    student_id: id,
    name,
    moodle_id: `${POISON}-moodle@example.test`,
    status: complete ? 'OK' : evaluable === 0 ? 'NOT_EVALUATED' : 'PARTIAL',
    started_at: '2026-10-02T10:00:00Z',
    finished_at: '2026-10-02T10:05:00Z',
    score: {
      obtained,
      evaluable,
      total,
      unevaluated: pending,
      provisional_score: evaluable ? Math.round((100 * obtained) / evaluable) : null,
      final_score: complete ? Math.round((100 * obtained) / total) : null,
      status: complete ? 'COMPLETE' : evaluable === 0 ? 'NOT_EVALUATED' : 'INCOMPLETE'
    },
    checks
  }
}

function run(): RunResult {
  const base = validRun()
  const ana = student('a1', 'Ana <b>Ficticia</b>', [
    check('red', 'Red', 'PASS'),
    check('dns', 'DNS', 'FAIL'),
    check('dhcp', 'DNS', 'PASS')
  ])
  const otro = student('b2', `Otro ${POISON}-alumno`, [
    check('red', 'Red', 'PASS'),
    check('dns', 'DNS', 'UNEVALUATED'),
    check('dhcp', 'DNS', 'PASS')
  ])
  return {
    ...base,
    status: 'PARTIAL',
    exam: { path: `/home/${POISON}/examen.yaml`, sha256: 'a'.repeat(64) },
    inventory: { path: `/home/${POISON}/aula.yaml`, sha256: 'b'.repeat(64) },
    plan: { ...base.plan, check_count: 3, total_weight: 3, check_ids: ['red', 'dns', 'dhcp'] },
    warnings: [{ scope: 'run', code: 'X', message: `${POISON}-warning ${PASSWORD}` }],
    students: [ana, otro, { ...student('c3', 'Excluida', []), status: 'EXCLUDED' }]
  }
}

const scale = scaleOf('ten', 70)

describe('student reports (T185)', () => {
  it('carries no command, output, password, path or other student', () => {
    const pages = studentReports(run(), scale, 'Examen de redes')
    expect(Object.keys(pages)).toHaveLength(2)
    const [ana, otro] = Object.values(pages)
    expect(ana).not.toContain(POISON)
    expect(ana).not.toContain(PASSWORD)
    expect(ana).not.toContain('Otro')
    expect(otro).not.toContain(PASSWORD)
    expect(otro.replaceAll(`Otro ${POISON}-alumno`, '')).not.toContain(POISON)
  })

  it('escapes what the classroom wrote', () => {
    const html = studentReport(run(), run().students[0], scale, 'A & <B>')
    expect(html).toContain('Ana &lt;b&gt;Ficticia&lt;/b&gt;')
    expect(html).toContain('A &amp; &lt;B&gt;')
    expect(html).not.toContain('<b>Ficticia')
  })

  it('shows the grade in the teacher scale, the exam, the date and every check by group', () => {
    const html = studentReport(run(), run().students[0], scale, 'Examen de redes')
    // 2 of 3 is 67 over 100, under the pass mark of 70: 4,8 out of 10.
    expect(html).toContain('<span>4,8</span><small>/ 10</small>')
    expect(html).toContain('Suspenso')
    expect(html).toContain('Examen de redes')
    expect(html).toContain('02/10/2026')
    expect(html.indexOf('<h2>Red</h2>')).toBeLessThan(html.indexOf('<h2>DNS</h2>'))
    expect(html).toContain('1 de 2 correctas')
    for (const id of ['red', 'dns', 'dhcp']) expect(html).toContain(`Descripción ${id}`)
    expect(html.match(/class="check pass"/g)).toHaveLength(2)
    expect(html.match(/class="check fail"/g)).toHaveLength(1)
  })

  it('writes an unchecked check apart from a failed one, and no final grade', () => {
    const html = studentReport(run(), run().students[1], scale, 'Examen')
    expect(html).toContain('class="check unchecked"')
    expect(html).toContain('No se pudo comprobar')
    expect(html).toContain('No se pudo conectar con la máquina')
    expect(html).not.toContain('class="check fail"')
    expect(html).toContain('«No se pudo comprobar» no es un fallo.')
    expect(html).toContain('Sin nota final')
    expect(html).not.toContain('<small>/ 10</small>')
  })

  it('gives each student their own page, one file name per exam, and says who is left out', () => {
    const r = run()
    const pages = studentReports(r, scale, 'Examen')
    for (const student of r.students.filter((s) => s.status !== 'EXCLUDED')) {
      expect(pages[student.student_id]).toBe(studentReport(r, student, scale, 'Examen'))
    }
    expect(Object.keys(pages)).not.toContain('c3')
    expect(reportFileName('Examen RA2 · Redes')).toBe('informe-examen-ra2-redes.html')
    expect(reportFileName('«»')).toBe('informe-examen.html')
    expect(reportFileName(`${'a'.repeat(59)} b`)).toMatch(/^informe-a+\.html$/)
    expect(reportsSummary(r)).toContain('2 alumnos')
    expect(reportsSummary(r)).toContain('1 excluidos sin informe')
  })

  it('takes the title only from the exam that was corrected', async () => {
    const yaml = 'examen: "Examen RA2"\nversion: 1\nhosts: [h]\ngrupos: []\n'
    const sha = createHash('sha256').update(yaml).digest('hex')
    expect(await examTitleOf(yaml, sha, 'carpeta')).toBe('Examen RA2')
    expect(await examTitleOf(yaml, 'f'.repeat(64), 'carpeta')).toBe('carpeta')
    expect(await examTitleOf(null, sha, 'carpeta')).toBe('carpeta')
  })
})

describe('sending the reports (ADR-0031)', () => {
  it('keeps the password and the pages out of argv', () => {
    const args = deliverArgs('/aula/var/run-1.json', 'informe-redes.html')
    expect(args).toEqual(['deliver', '--secrets=stdin', '--artifact=/aula/var/run-1.json', '--file=informe-redes.html'])
    const input = deliverInput({ AULA_PASSWORD: PASSWORD }, { c1: '<p>Ana</p>' })
    const [secrets, reports] = input.split('\n')
    expect(JSON.parse(secrets)).toEqual({ schema: 1, secrets: { AULA_PASSWORD: PASSWORD } })
    expect(JSON.parse(reports)).toEqual({ schema: 1, reports: { c1: '<p>Ana</p>' } })
    expect(args.join(' ')).not.toContain(PASSWORD)
  })

  it('reads to whom it arrived, and the engine refusal as a sentence', () => {
    const line = JSON.stringify({
      kind: 'delivery', delivery_version: 1, run_id: 'R', file: 'informe-x.html',
      students: [
        { student_id: 'a', name: 'Ana', delivered: true },
        { student_id: 'b', name: 'Bea', delivered: false, reason: 'no se ha podido conectar' }
      ]
    })
    expect(readDelivery(3, line, '').students).toEqual([
      { student_id: 'a', name: 'Ana', delivered: true, reason: undefined },
      { student_id: 'b', name: 'Bea', delivered: false, reason: 'no se ha podido conectar' }
    ])
    expect(() => readDelivery(2, '', 'heimdall deliver: el examen o la clase han cambiado\n')).toThrow(
      'el examen o la clase han cambiado'
    )
    expect(() => readDelivery(0, '{"kind":"run"}', '')).toThrow()
  })
})
