import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  allChecks,
  checkCount,
  checkProblem,
  commandLine,
  emptyCheck,
  emptyExam,
  examYaml,
  readCommandLine,
  readExam,
  totalWeight,
  type Check,
  type Exam
} from '../src/shared/exam'

const REPO = join(__dirname, '..', '..')

function parse(yaml: string): Exam {
  const read = readExam(yaml)
  if ('problem' in read) throw new Error(read.problem)
  return read.exam
}

describe('el examen de ida y vuelta', () => {
  it('lo editado en la vista visual sale en el YAML', () => {
    const exam = emptyExam('Prueba')
    exam.grupos = [
      {
        grupo: 'Red',
        comprobaciones: [
          {
            ...emptyCheck('host1'),
            id: 'dns-activo',
            descripcion: 'named responde',
            cmd: ['dig', '+short', '@127.0.0.1'],
            assertion: { kind: 'igual_a', value: '10.1.1.100' },
            peso: '2',
            timeout: '10s'
          }
        ]
      }
    ]
    const yaml = examYaml(exam)
    expect(yaml).toContain('id: "dns-activo"')
    expect(yaml).toContain('igual_a: "10.1.1.100"')
    expect(yaml).toContain('peso: 2')
    expect(yaml).toContain('timeout: "10s"')
  })

  it('lo escrito en el YAML sale en la vista visual', () => {
    const exam = parse(`
examen: "Prueba"
version: 3
hosts: [host1, host2]
por_defecto: { peso: 1, timeout: 20s }
grupos:
  - grupo: "DNS"
    comprobaciones:
      - id: sin-recursion
        descripcion: "No hay recursión abierta"
        en: host2
        cmd: ["cat", "/etc/bind/named.conf.options"]
        no_contiene: "allow-recursion { any; }"
`)
    expect(exam.version).toBe(3)
    expect(exam.hosts).toEqual(['host1', 'host2'])
    const [check] = allChecks(exam)
    expect(check.en).toBe('host2')
    expect(check.cmd).toEqual(['cat', '/etc/bind/named.conf.options'])
    expect(check.assertion).toEqual({ kind: 'no_contiene', value: 'allow-recursion { any; }' })
  })

  it('el examen real del curso da la vuelta entera sin perder nada', () => {
    const yaml = readFileSync(join(REPO, 'testdata', 'ra2', 'examen.yaml'), 'utf-8')
    const once = parse(yaml)
    const twice = parse(examYaml(once))
    expect(twice).toEqual(once)
    expect(checkCount(twice)).toBe(checkCount(once))
    expect(totalWeight(twice)).toBe(totalWeight(once))
  })

  it('conserva la aserción de cercanía con su ancla y sus líneas', () => {
    const exam = parse(`
examen: "P"
version: 1
hosts: [host1]
grupos:
  - grupo: "G"
    comprobaciones:
      - id: kea-red
        descripcion: "KEA declara la subred"
        en: host1
        cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]
        cerca_de: { ancla: '"subnet"', lineas: 5, contiene: "10.0.0.0/8" }
`)
    expect(allChecks(exam)[0].assertion).toEqual({
      kind: 'cerca_de',
      value: '10.0.0.0/8',
      anchor: '"subnet"',
      lines: '5'
    })
    expect(examYaml(exam)).toContain('lineas: 5')
  })

  it('una comprobación sin comando conserva su valor del alumno', () => {
    const exam = parse(`
examen: "P"
version: 1
hosts: [host1]
grupos:
  - grupo: "Cuestionario"
    comprobaciones:
      - id: q-https
        descripcion: "Puerto de HTTPS"
        valor: "\${alumno.p1}"
        igual_a: "443"
`)
    const [check] = allChecks(exam)
    expect(check.valor).toBe('${alumno.p1}')
    expect(check.cmd).toEqual([])
    // Y al escribirlo no se inventa ningún host ni ningún comando.
    const yaml = examYaml(exam)
    expect(yaml).not.toMatch(/^\s+cmd:/m)
    expect(yaml).not.toMatch(/^\s+en:/m)
  })

  it('un YAML que no se puede leer se dice, no se vacía', () => {
    const read = readExam('examen: "P"\n  mal: [')
    expect('problem' in read).toBe(true)
  })
})

describe('el peso total', () => {
  it('es el denominador que comparten todos los alumnos', () => {
    const exam = parse(readFileSync(join(REPO, 'testdata', 'ra2', 'examen.yaml'), 'utf-8'))
    // Cada comprobación cuenta por su peso, y las que no lo dicen por el de
    // por_defecto: nunca por cero.
    expect(totalWeight(exam)).toBeGreaterThanOrEqual(checkCount(exam))
  })

  it('una comprobación sin peso vale lo que diga por_defecto', () => {
    const exam = emptyExam('P')
    exam.porDefecto.peso = '3'
    exam.grupos = [{ grupo: 'G', comprobaciones: [emptyCheck('host1'), emptyCheck('host1')] }]
    expect(totalWeight(exam)).toBe(6)
  })
})

describe('lo que no se deja escribir', () => {
  const exam = emptyExam('P')
  const base = (over: Partial<Check> = {}): Check => ({
    ...emptyCheck('host1'),
    id: 'uno',
    descripcion: 'algo',
    cmd: ['hostname'],
    assertion: { kind: 'contiene', value: 'x' },
    ...over
  })

  it('acepta una comprobación entera', () => {
    expect(checkProblem(base(), exam, [])).toBeNull()
  })

  it('no deja una comprobación sin identificador ni sin descripción', () => {
    expect(checkProblem(base({ id: '' }), exam, [])).toMatch(/identificador/)
    expect(checkProblem(base({ descripcion: '' }), exam, [])).toMatch(/descripción/)
  })

  it('no deja repetir un identificador: es lo que compara dos correcciones', () => {
    const otra = base()
    expect(checkProblem(base(), exam, [otra, base()])).toMatch(/«uno»/)
  })

  it('no deja una máquina que el examen no declara', () => {
    expect(checkProblem(base({ en: 'host9' }), exam, [])).toMatch(/host9/)
  })

  it('no deja una comprobación sin comando y sin valor', () => {
    expect(checkProblem(base({ cmd: [], valor: '' }), exam, [])).toMatch(/comando/)
  })

  it('exige un número en el código de salida y en el peso', () => {
    expect(checkProblem(base({ assertion: { kind: 'exit_code', value: 'cero' } }), exam, [])).toMatch(
      /número/
    )
    expect(checkProblem(base({ peso: '0' }), exam, [])).toMatch(/peso/)
    expect(checkProblem(base({ peso: '2' }), exam, [])).toBeNull()
  })

  it('exige ancla y líneas en la búsqueda por cercanía', () => {
    const near = base({ assertion: { kind: 'cerca_de', value: 'x', anchor: '', lines: '5' } })
    expect(checkProblem(near, exam, [])).toMatch(/anclaje/)
    expect(
      checkProblem(
        base({ assertion: { kind: 'cerca_de', value: 'x', anchor: 'a', lines: '5' } }),
        exam,
        []
      )
    ).toBeNull()
  })

  it('exige que el tiempo máximo lleve unidad', () => {
    expect(checkProblem(base({ timeout: '20' }), exam, [])).toMatch(/20s/)
    expect(checkProblem(base({ timeout: '2m' }), exam, [])).toBeNull()
  })
})

describe('el comando como una línea', () => {
  it('da la vuelta sin romper un argumento con espacios', () => {
    const cmd = ['grep', '-c', 'allow recursion', '/etc/bind/named.conf']
    expect(readCommandLine(commandLine(cmd))).toEqual(cmd)
  })

  it('no interpreta nada: un punto y coma es un argumento más', () => {
    expect(readCommandLine('echo hola;rm')).toEqual(['echo', 'hola;rm'])
  })

  it('conserva un argumento vacío entre comillas', () => {
    expect(readCommandLine('grep "" fichero')).toEqual(['grep', '', 'fichero'])
  })
})
