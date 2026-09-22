import { describe, expect, it } from 'vitest'
import {
  csvName,
  exportSummary,
  gradeRow,
  gradeRows,
  toCsv
} from '../src/renderer/src/lib/export'
import { DEFAULT_PASS_MARK, DEFAULT_SCALE, SCALES, markOf, scaleOf, toScale } from '../src/renderer/src/lib/scale'
import type { CheckResult, RunResult, StudentResult } from '../src/shared/artifact'
import type { Score } from '../src/shared/events'

const SECRET = 'contrasena-del-aula'

function score(partial: Partial<Score>): Score {
  return {
    obtained: 0,
    evaluable: 0,
    total: 10,
    unevaluated: 10,
    provisional_score: null,
    final_score: null,
    status: 'NOT_EVALUATED',
    ...partial
  }
}

function check(partial: Partial<CheckResult>): CheckResult {
  return {
    check_id: 'C-1',
    group: 'red',
    description: 'El servidor responde',
    weight: 5,
    status: 'PASS',
    cause: 'NONE',
    execution: null,
    assertion: null,
    ...partial
  }
}

function student(partial: Partial<StudentResult>): StudentResult {
  return {
    student_id: 'alu1',
    name: 'Alumna Uno',
    status: 'OK',
    started_at: '2026-09-20T10:00:00Z',
    finished_at: '2026-09-20T10:01:00Z',
    score: score({}),
    checks: [check({})],
    ...partial
  }
}

/** Un alumno con todo evaluado y nota cerrada. */
const evaluated = student({
  student_id: 'alu1',
  name: 'Alumna Uno',
  moodle_id: '10234',
  status: 'OK',
  score: score({ obtained: 9, evaluable: 10, unevaluated: 0, provisional_score: 90, final_score: 90, status: 'COMPLETE' }),
  checks: [check({ check_id: 'C-1' }), check({ check_id: 'C-2', status: 'FAIL' })]
})

/** Un alumno al que le falta una comprobación por evaluar. */
const incomplete = student({
  student_id: 'alu2',
  name: 'Alumno Dos',
  status: 'PARTIAL',
  score: score({ obtained: 4, evaluable: 6, unevaluated: 4, provisional_score: 67, final_score: null, status: 'INCOMPLETE' }),
  checks: [check({ check_id: 'C-1' }), check({ check_id: 'C-2', status: 'UNEVALUATED', cause: 'CONNECT_FAILED' })]
})

/** Un alumno con la máquina apagada: no se pudo mirar nada. */
const unreachable = student({
  student_id: 'alu3',
  name: 'Alumna Tres',
  status: 'NOT_EVALUATED',
  score: score({ status: 'NOT_EVALUATED' }),
  checks: [check({ check_id: 'C-1', status: 'UNEVALUATED', cause: 'CONNECT_FAILED' })]
})

const excluded = student({
  student_id: 'alu4',
  name: 'Alumno Cuatro',
  status: 'EXCLUDED',
  score: score({ total: 10, unevaluated: 0, status: 'EXCLUDED' }),
  checks: []
})

function run(students: StudentResult[]): RunResult {
  return {
    schema_version: 1,
    run_id: '01JABCDEF',
    engine_version: '0.1.0',
    started_at: '2026-09-20T10:00:00Z',
    finished_at: '2026-09-20T10:05:00Z',
    status: 'PARTIAL',
    exam: { path: '/aulas/smx2/examen.yaml', sha256: 'aa' },
    inventory: { path: '/aulas/smx2/aula.yaml', sha256: 'bb' },
    plan_hash: 'cc',
    plan: { check_count: 2, total_weight: 10, check_ids: ['C-1', 'C-2'], concurrency: 16, host_concurrency: 4 },
    students
  }
}

describe('la escala del profesor', () => {
  it('pone el aprobado justo en la mitad de la escala, no donde caiga', () => {
    // Lo que el profesor da por aprobado es un 5, y de ahí sale todo lo demás.
    expect(toScale(DEFAULT_PASS_MARK, SCALES.ten)).toBe('5,0')
    expect(toScale(0, SCALES.ten)).toBe('0,0')
    expect(toScale(100, SCALES.ten)).toBe('10,0')
    // Por debajo del aprobado, repartido entre 0 y 5; por encima, entre 5 y 10.
    expect(toScale(35, SCALES.ten)).toBe('2,5')
    expect(toScale(85, SCALES.ten)).toBe('7,5')
    expect(toScale(90, SCALES.ten)).toBe('8,3')
  })

  it('la marca que mueva el profesor arrastra la escala entera', () => {
    const mitad = scaleOf('ten', 50)
    expect(toScale(50, mitad)).toBe('5,0')
    expect(toScale(90, mitad)).toBe('9,0')
  })

  it('una marca imposible no rompe la conversión', () => {
    expect(markOf(0)).toBe(1)
    expect(markOf(100)).toBe(99)
    expect(markOf(Number.NaN)).toBe(DEFAULT_PASS_MARK)
  })

  it('por defecto se marca sobre 10 y una escala desconocida no inventa otra', () => {
    expect(DEFAULT_SCALE).toBe('ten')
    expect(scaleOf(null)).toEqual(SCALES.ten)
    expect(scaleOf('lo-que-sea')).toEqual(SCALES.ten)
    expect(scaleOf('hundred')).toEqual(SCALES.hundred)
  })

  it('la conversión no toca el resultado del motor', () => {
    const artifact = run([evaluated])
    const before = JSON.stringify(artifact)
    toCsv(artifact, SCALES.hundred)
    toCsv(artifact, SCALES.ten)
    expect(JSON.stringify(artifact)).toBe(before)
  })
})

describe('qué exporta cada alumno', () => {
  it('el que tiene nota final la exporta en la escala del profesor', () => {
    expect(gradeRow(evaluated, SCALES.ten)).toMatchObject({
      name: 'Alumna Uno',
      moodleId: '10234',
      grade: '8,3',
      note: '',
      pass: 1,
      fail: 1,
      unevaluated: 0
    })
  })

  it('el que no la tiene no exporta ninguna nota: exporta que no la tiene', () => {
    for (const row of [gradeRow(incomplete, SCALES.ten), gradeRow(unreachable, SCALES.ten), gradeRow(excluded, SCALES.ten)]) {
      expect(row.grade).toBe('')
      expect(row.note).toMatch(/^sin nota: /)
    }
    // Y la provisional no se cuela por ninguna parte.
    expect(gradeRow(incomplete, SCALES.ten).note).toContain('falta por comprobar')
    expect(gradeRow(incomplete, SCALES.ten).note).not.toContain('67')
    expect(gradeRow(unreachable, SCALES.ten).note).toContain('no se pudo evaluar')
    expect(gradeRow(excluded, SCALES.ten).note).toContain('excluido')
  })

  it('sin identificador de Moodle la columna va vacía y no se inventa uno', () => {
    expect(gradeRow(incomplete, SCALES.ten).moodleId).toBe('')
  })

  it('exporta a todos los alumnos del aula, con nota o sin ella', () => {
    expect(gradeRows(run([evaluated, incomplete, unreachable, excluded]), SCALES.ten)).toHaveLength(4)
  })
})

describe('el fichero de notas', () => {
  const csv = toCsv(run([evaluated, incomplete, unreachable, excluded]), SCALES.ten)
  const lines = csv.replace(/^﻿/, '').trimEnd().split('\r\n')

  it('lleva una cabecera y una línea por alumno', () => {
    expect(lines).toHaveLength(5)
    expect(lines[0]).toBe('alumno;identificador;moodle;estado;nota;escala;observaciones;bien;mal;sin_evaluar')
    expect(lines[1]).toBe('Alumna Uno;alu1;10234;Evaluado;8,3;10;;1;1;0')
  })

  it('lo abre una hoja de cálculo en español sin romper los acentos', () => {
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('no saca ni un secreto ni nada de lo que escribieron las máquinas', () => {
    const withOutput = student({
      student_id: 'alu5',
      name: 'Alumno Cinco',
      score: score({ obtained: 10, evaluable: 10, unevaluated: 0, provisional_score: 100, final_score: 100, status: 'COMPLETE' }),
      checks: [
        check({
          execution: {
            host: 'pc5',
            address: '127.1.2.3',
            user: 'alu5',
            transport: 'ssh',
            command: ['cat', '/etc/shadow'],
            started_at: '2026-09-20T10:00:00Z',
            duration_ms: 12,
            completed: true,
            exit_code: 0,
            overflow: false,
            stdout: { text: SECRET, bytes: SECRET.length, bytes_total: SECRET.length, truncated: false },
            stderr: { text: '', bytes: 0, bytes_total: 0, truncated: false },
            connect_attempts: 1,
            command_attempts: 1,
            remote_process: 'FINISHED'
          },
          assertion: { kind: 'stdout_contains', expected: SECRET, found: SECRET, matched: true }
        })
      ]
    })
    const text = toCsv(run([withOutput]), SCALES.ten)
    expect(text).not.toContain(SECRET)
    expect(text).not.toContain('/etc/shadow')
    expect(text).not.toContain('127.1.2.3')
  })

  it('un nombre que empieza como una fórmula sale como texto', () => {
    const tricky = student({ student_id: '=cmd', name: '=HYPERLINK("http://x")' })
    const text = toCsv(run([tricky]), SCALES.ten)
    // Con comillas dentro, el campo va entrecomillado y las comillas dobladas.
    expect(text).toContain('"\'=HYPERLINK(""http://x"")"')
    expect(text).toMatch(/'=cmd/)
  })

  it('un punto y coma en un nombre no parte la línea en dos', () => {
    const text = toCsv(run([student({ name: 'Uno; Dos' })]), SCALES.ten)
    expect(text).toContain('"Uno; Dos"')
    expect(text.replace(/^﻿/, '').trimEnd().split('\r\n')).toHaveLength(2)
  })
})

describe('lo que se le dice al profesor antes de guardar', () => {
  it('cuenta cuántos llevan nota y cuántos no', () => {
    const text = exportSummary(run([evaluated, incomplete, unreachable]), SCALES.ten)
    expect(text).toContain('3 alumnos')
    expect(text).toContain('1 con nota final')
    expect(text).toContain('2 sin nota')
    expect(text).toContain('0 a 10')
  })

  it('propone un nombre de fichero que no pisa el de otra corrección', () => {
    expect(csvName(run([evaluated]))).toBe('notas-examen-20260920-100000.csv')
  })
})
