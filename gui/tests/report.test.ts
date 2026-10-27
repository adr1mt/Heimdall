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
import { scaleOf, toScale } from '../src/renderer/src/lib/scale'
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

  it('gives each student their own page, one fixed file name for every exam, and says who is left out', () => {
    const r = run()
    const pages = studentReports(r, scale, 'Examen')
    for (const student of r.students.filter((s) => s.status !== 'EXCLUDED')) {
      expect(pages[student.student_id]).toBe(studentReport(r, student, scale, 'Examen'))
    }
    expect(Object.keys(pages)).not.toContain('c3')
    expect(reportFileName()).toBe('informe.html')
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

  it('omits the review when everything passed or could not be evaluated', () => {
    for (const status of ['PASS', 'UNEVALUATED'] as const) {
      const s = student('a', 'Alumna ficticia', [check('uno', 'Red', status)])
      const html = studentReport(run(), s, scale, 'Examen')
      expect(html).not.toContain('Qué debes revisar')
      if (status === 'UNEVALUATED') {
        expect(html).toContain('Sin nota final')
        expect(html).toContain('No se pudo comprobar ninguna parte del examen.')
        expect(html).not.toContain('>Aprobado<')
        expect(html).not.toContain('>Suspenso<')
      }
    }
  })

  it('reviews only academic failures, after the technical notice and before the full breakdown', () => {
    const s = student('a', 'Alumna ficticia', [
      check('ok', 'Red', 'PASS'), check('fallo1', 'Red', 'FAIL'),
      check('tecnico', 'DNS', 'UNEVALUATED'), check('fallo2', 'DNS', 'FAIL')
    ])
    const html = studentReport(run(), s, scale, 'Examen')
    const review = html.slice(html.indexOf('<section class="review"'), html.indexOf('<section id="desglose"'))
    expect(review).toContain('Comprobaciones no superadas')
    expect(review).toContain('Descripción fallo1')
    expect(review).toContain('Descripción fallo2')
    expect(review).not.toContain('Descripción ok')
    expect(review).not.toContain('Descripción tecnico')
    expect(review.indexOf('<h3>Red</h3>')).toBeLessThan(review.indexOf('<h3>DNS</h3>'))
    expect(html.indexOf('<aside class="note"')).toBeLessThan(html.indexOf('<section class="review"'))
    expect(html).toContain('Sin nota final')
    expect(html).not.toContain(POISON)
    expect(html).not.toContain(PASSWORD)
  })

  it('limits the review to eight failures in block order while preserving every row in the breakdown', () => {
    const checks = Array.from({ length: 13 }, (_, i) => check(`f${i}`, i < 5 ? 'Primero' : 'Segundo', 'FAIL'))
    const html = studentReport(run(), student('a', 'Alumna ficticia', checks), scale, 'Examen')
    const [before, full] = html.split('<section id="desglose"')
    const review = before.slice(before.indexOf('<section class="review"'))
    expect(review.match(/<li>/g)).toHaveLength(8)
    expect(review).toContain('5 comprobaciones falladas más')
    expect(review).toContain('href="#desglose"')
    expect(review).not.toContain('Descripción f8')
    expect(full.match(/class="check fail"/g)).toHaveLength(13)
    for (const c of checks) expect(full).toContain(c.description)
    expect(full.indexOf('<h2>Primero</h2>')).toBeLessThan(full.indexOf('<h2>Segundo</h2>'))
    const eight = studentReport(run(), student('a', 'Demo', checks.slice(0, 8)), scale, 'Examen')
    expect(eight).not.toContain('comprobaciones falladas más')
  })

  it('escapes descriptions and block names in both lists without exposing internal diagnostics', () => {
    const c = { ...check('x', '<img src=x onerror="bad()">', 'FAIL'), description: 'A & <script>bad()</script> "texto"' }
    const html = studentReport(run(), student('a', 'Demo', [c]), scale, 'Examen')
    expect(html.match(/A &amp; &lt;script&gt;bad\(\)&lt;\/script&gt; &quot;texto&quot;/g)).toHaveLength(2)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain(POISON)
    expect(html).not.toContain(PASSWORD)
    expect(html).not.toContain('src="http')
    expect(html).not.toContain('<link')
  })

  it('keeps canonical weighted grades, both scales, decimals and configurable pass marks', () => {
    // Half of the checks pass, but they carry 9 of 10 weight: the grade is 90.
    const s = student('a', 'Demo', [check('ok', 'Red', 'PASS', 9), check('fallo', 'Red', 'FAIL')])
    for (const id of ['ten', 'hundred'] as const) {
      for (const passMark of [60, 90, 95]) {
        const selected = { ...scaleOf(id, passMark), decimals: 2 }
        const html = studentReport(run(), s, selected, 'Examen')
        expect(html).toContain(`<span>${toScale(90, selected)}</span><small>/ ${selected.max}</small>`)
        expect(html).toContain(passMark <= 90 ? '>Aprobado<' : '>Suspenso<')
        expect(html).toContain('peso 9')
        expect(html).toContain('peso 1')
        expect(html).toContain('1 correctas, 1 falladas y 0 sin comprobar de 2')
      }
    }
    const source = structuredClone(s)
    studentReport(run(), s, scale, 'Examen')
    expect(s).toEqual(source)
  })

  it('handles an empty report without a misleading bar or a computed grade', () => {
    const s = { ...student('a', 'Demo', []), score: { ...student('a', 'Demo', []).score, status: 'NOT_EVALUATED' as const } }
    const html = studentReport(run(), s, scale, 'Examen')
    expect(html).toContain('No hay comprobaciones en este informe.')
    expect(html).not.toContain('class="bar"')
    expect(html).not.toMatch(/NaN|Infinity/)
    expect(html).not.toContain('Qué debes revisar')
    expect(html).toContain('Sin nota final')
  })

  it('keeps a canonical final grade when only a zero-weight check could not be evaluated', () => {
    const s = student('a', 'Demo', [check('ok', 'Red', 'PASS'), check('diagnostico', 'Red', 'UNEVALUATED', 0)])
    const html = studentReport(run(), s, scale, 'Examen')
    expect(html).toContain('<span>10,0</span><small>/ 10</small>')
    expect(html).toContain('>Aprobado<')
    expect(html).toContain('No se pudo comprobar')
    expect(html).toContain('peso 0')
    expect(html).not.toContain('Sin nota final')
    expect(html).not.toContain('Qué debes revisar')
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
