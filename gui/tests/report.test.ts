import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CheckResult, RunResult, StudentResult } from '../src/shared/artifact'
import {
  examTitleOf,
  reportFiles,
  reportsFolderName,
  reportsSummary,
  studentReport
} from '../src/renderer/src/lib/report'
import { scaleOf } from '../src/renderer/src/lib/scale'
import { writeReports } from '../src/main/reports'
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
    const files = reportFiles(run(), scale, 'Examen de redes')
    expect(files).toHaveLength(2)
    const ana = files[0].html
    expect(ana).not.toContain(POISON)
    expect(ana).not.toContain(PASSWORD)
    expect(ana).not.toContain('Otro')
    expect(files[1].html).not.toContain(PASSWORD)
    expect(files[1].html.replaceAll(`Otro ${POISON}-alumno`, '')).not.toContain(POISON)
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

  it('names files and folder without clashes and says who is left out', () => {
    const r = run()
    r.students[1] = { ...r.students[1], name: r.students[0].name }
    const names = reportFiles(r, scale, 'Examen').map((f) => f.name)
    expect(names).toEqual(['ana-b-ficticia-b.html', 'ana-b-ficticia-b-b2.html'])
    expect(reportsFolderName(r, 'Examen RA2 · Redes')).toBe('informes-examen-ra2-redes-20261002-100000')
    expect(reportsSummary(r)).toContain('2 informes')
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

describe('writing the reports', () => {
  it('always writes a new folder and refuses unsafe names', () => {
    const parent = mkdtempSync(join(tmpdir(), 'heimdall-reports-'))
    const files = [{ name: 'ana.html', html: '<p>a</p>' }]
    const first = writeReports(parent, 'informes-x', files)
    writeFileSync(join(first, 'ana.html'), 'ya repartido')
    const second = writeReports(parent, 'informes-x', files)
    expect(second).toBe(join(parent, 'informes-x-2'))
    expect(readFileSync(join(first, 'ana.html'), 'utf-8')).toBe('ya repartido')
    expect(readdirSync(second)).toEqual(['ana.html'])
    expect(writeReports(parent, '../../fuera', files)).toBe(join(parent, 'fuera'))
    expect(readdirSync(writeReports(parent, 'y', [{ name: '../../evil.html', html: '' }]))).toEqual(['evil.html'])
    expect(() => writeReports(parent, 'z', [{ name: 'a.sh', html: '' }])).toThrow()
    expect(() => writeReports(parent, 'z', [])).toThrow()
    expect(() => writeReports(parent, 'z', [files[0], files[0]])).toThrow()
  })
})
