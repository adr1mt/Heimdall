import { describe, expect, it } from 'vitest'
import {
  SCALES,
  gradeRows,
  moodleCsv,
  moodleCsvName,
  moodleRows,
  moodleSummary
} from '../src/renderer/src/lib/export'
import type { RunResult } from '../src/shared/artifact'
import type { Score } from '../src/shared/events'

const TEN = SCALES.ten

function score(status: Score['status'], final: number | null): Score {
  return {
    obtained: 0,
    evaluable: final === null ? 6 : 10,
    total: 10,
    unevaluated: final === null ? 4 : 0,
    provisional_score: 67,
    final_score: final,
    status
  }
}

function student(
  id: string,
  name: string,
  moodleId: string | undefined,
  status: Score['status'],
  final: number | null
) {
  return {
    student_id: id,
    name,
    moodle_id: moodleId,
    status: final === null ? ('PARTIAL' as const) : ('OK' as const),
    score: score(status, final),
    checks: [{ status: 'PASS' as const }]
  }
}

const RUN = {
  students: [
    student('alu1', 'Alumna Uno', 'uno@elpuig.cat', 'COMPLETE', 80),
    student('alu2', 'Alumne Dos', 'dos@elpuig.cat', 'INCOMPLETE', null),
    student('alu3', 'Alumna Tres', undefined, 'COMPLETE', 100),
    student('alu4', 'Alumne Cuatro', '', 'NOT_EVALUATED', null)
  ]
} as unknown as RunResult

function rows() {
  return gradeRows(RUN, TEN)
}

describe('exportación a Moodle', () => {
  it('la cabecera es la mínima que Moodle necesita emparejar y calificar', () => {
    const lines = moodleCsv(moodleRows(rows())).split('\r\n')
    expect(lines[0]).toBe('alumno;correo;nota')
  })

  it('la nota es la misma que se ve en pantalla, en la escala del profesor', () => {
    const lines = moodleCsv(moodleRows(rows())).split('\r\n')
    expect(lines[1]).toBe('Alumna Uno;uno@elpuig.cat;8,0')
    expect(moodleCsv(moodleRows(gradeRows(RUN, SCALES.hundred))).split('\r\n')[1]).toBe(
      'Alumna Uno;uno@elpuig.cat;80'
    )
  })

  it('quien no tiene nota final sale con la celda vacía, nunca con un cero', () => {
    const lines = moodleCsv(moodleRows(rows())).split('\r\n')
    expect(lines[2]).toBe('Alumne Dos;dos@elpuig.cat;')
    expect(lines[2]).not.toContain('0')
  })

  it('sin correo no hay línea: Moodle no sabría a quién ponerle la nota', () => {
    const list = moodleRows(rows())
    expect(list.map((r) => r.name)).toEqual(['Alumna Uno', 'Alumne Dos'])
  })

  it('dejar a alguien fuera no es silencioso: el resumen lo dice antes de guardar', () => {
    const text = moodleSummary(rows(), TEN)
    expect(text).toContain('2 alumnos en el fichero')
    expect(text).toContain('1 con nota')
    expect(text).toContain('1 sin nota')
    expect(text).toContain('2 fuera del fichero por no tener correo')
  })

  it('sin nadie fuera el resumen no habla de correos', () => {
    const two = rows().slice(0, 2)
    expect(moodleSummary(two, TEN)).not.toContain('correo')
  })

  it('un nombre que empieza como una fórmula viaja como dato (F-14)', () => {
    const hostile = [{ name: '=cmd|calc!A1', moodleId: 'x@y.cat', grade: '8,0' }]
    const line = moodleCsv(moodleRows(hostile)).split('\r\n')[1]
    expect(line.startsWith("'=")).toBe(true)
  })

  it('un punto y coma en un nombre no parte la línea en dos alumnos', () => {
    const tricky = [{ name: 'Uno; Dos', moodleId: 'x@y.cat', grade: '8,0' }]
    const lines = moodleCsv(moodleRows(tricky)).split('\r\n')
    expect(lines).toHaveLength(3) // cabecera, un alumno y el salto final
    expect(lines[1]).toBe('"Uno; Dos";x@y.cat;8,0')
  })

  it('no lleva marca de orden de bytes: la leería Moodle dentro del nombre de la columna', () => {
    expect(moodleCsv(moodleRows(rows())).startsWith('﻿')).toBe(false)
  })

  it('no lleva nada que explique una nota: ni estado, ni motivos, ni recuentos', () => {
    const text = moodleCsv(moodleRows(rows()))
    expect(text).not.toContain('sin nota')
    expect(text).not.toContain('Incompleto')
  })

  it('el fichero se llama distinto de la hoja de notas', () => {
    expect(moodleCsvName('2026-09-22T09:30:00Z')).toBe('moodle-20260922-093000.csv')
  })
})
