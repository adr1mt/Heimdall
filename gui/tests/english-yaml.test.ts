import { describe, expect, it } from 'vitest'
import { load } from 'js-yaml'
import { emptyExam, emptyCheck, examYaml, readExam } from '../src/shared/exam'
import { aulaYaml } from '../src/shared/aula'
import { isColumnName } from '../src/shared/classes'

describe('English-only authoring', () => {
  const source = 'exam: Prueba\nversion: 1\nhosts: [host1]\ndefaults: {weight: 1}\ngroups:\n  - group: G\n    checks:\n      - id: c\n        description: Texto\n        on: host1\n        cmd: [hostname]\n        near: {anchor: host, lines: 1, contains: host}\n'
  it.each([['exam', 'examen'], ['defaults', 'por_defecto'], ['weight', 'peso'], ['groups', 'grupos'], ['group', 'grupo'], ['checks', 'comprobaciones'], ['description', 'descripcion'], ['on', 'en'], ['near', 'cerca_de'], ['anchor', 'ancla'], ['lines', 'lineas'], ['contains', 'contiene']])('rejects the old key %s → %s without discarding it', (key, old) => {
    expect(readExam(source.replace(`${key}:`, `${old}:`))).toHaveProperty('problem')
  })
  it('writes English syntax while preserving teacher text and free fields', () => {
    const exam = emptyExam('Examen en español')
    exam.hosts = []
    exam.groups = [{ group: 'Respuestas', checks: [{ ...emptyCheck(''), id: 'c', description: 'Descripción', value: '${student.respuesta}', assertion: { kind: 'equals', value: 'sí' } }] }]
    const yaml = examYaml(exam)
    expect(load(yaml)).toMatchObject({ exam: 'Examen en español', defaults: { weight: 1 }, groups: [{ group: 'Respuestas', checks: [{ description: 'Descripción', value: '${student.respuesta}', equals: 'sí' }] }] })
    expect(readExam(yaml)).toEqual({ exam })
  })
  it('generates English inventory, preserving login values and reserving identity keys', () => {
    const yaml = aulaYaml({ id: 'c', name: 'Clase', password: 'secret-not-to-serialize', columns: ['respuesta'], students: [{ id: 'a', name: 'Ana', user: 'alumno', port: '', host: '192.0.2.1', contact: '', fields: { respuesta: 'sí' } }] })
    expect(yaml).not.toContain('secret-not-to-serialize')
    expect(load(yaml)).toMatchObject({ classroom: 'Clase', common: { timeouts: { connect: '10s', student: '5m' }, hosts: { host1: { port: 22 } } }, students: [{ name: 'Ana', user: 'alumno', respuesta: 'sí', hosts: { host1: { user: 'alumno' } } }] })
    for (const key of ['name', 'excluded', 'user', 'nombre', 'excluido']) expect(isColumnName(key)).toBe(false)
  })
})
