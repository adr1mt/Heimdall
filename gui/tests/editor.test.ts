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
    exam.groups = [
      {
        group: 'Red',
        checks: [
          {
            ...emptyCheck('host1'),
            id: 'dns-activo',
            description: 'named responde',
            cmd: ['dig', '+short', '@127.0.0.1'],
            assertion: { kind: 'equals', value: '10.1.1.100' },
            weight: '2',
            timeout: '10s'
          }
        ]
      }
    ]
    const yaml = examYaml(exam)
    expect(yaml).toContain('id: "dns-activo"')
    expect(yaml).toContain('equals: "10.1.1.100"')
    expect(yaml).toContain('weight: 2')
    expect(yaml).toContain('timeout: "10s"')
  })

  it('lo escrito en el YAML sale en la vista visual', () => {
    const exam = parse(`
exam: "Prueba"
version: 3
hosts: [host1, host2]
defaults: { weight: 1, timeout: 20s }
groups:
  - group: "DNS"
    checks:
      - id: sin-recursion
        description: "No hay recursión abierta"
        on: host2
        cmd: ["cat", "/etc/bind/named.conf.options"]
        not_contains: "allow-recursion { any; }"
`)
    expect(exam.version).toBe(3)
    expect(exam.hosts).toEqual(['host1', 'host2'])
    const [check] = allChecks(exam)
    expect(check.on).toBe('host2')
    expect(check.cmd).toEqual(['cat', '/etc/bind/named.conf.options'])
    expect(check.assertion).toEqual({ kind: 'not_contains', value: 'allow-recursion { any; }' })
  })

  it('el examen real del curso da la vuelta entera sin perder nada', () => {
    const yaml = readFileSync(join(REPO, 'testdata', 'ra2', 'examen.yaml'), 'utf-8')
    const once = parse(yaml)
    const twice = parse(examYaml(once))
    expect(twice).toEqual(once)
    expect(checkCount(twice)).toBe(checkCount(once))
    expect(totalWeight(twice)).toBe(totalWeight(once))
  })

  it('conserva sudo en por_defecto y en cada comprobación (ADR-0032)', () => {
    const once = parse(`
exam: "P"
version: 1
hosts: [host1]
defaults: { weight: 1, timeout: 20s, sudo: true }
groups:
  - group: "G"
    checks:
      - id: kea-conf
        description: "Lee la configuración de Kea"
        on: host1
        cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]
        contains: "subnet4"
      - id: sin-sudo
        description: "El nombre de la máquina"
        on: host1
        sudo: false
        cmd: ["hostname"]
        contains: "srv"
`)
    expect(once.defaults.sudo).toBe(true)
    const [first, second] = allChecks(once)
    expect(first.sudo).toBeUndefined()
    expect(second.sudo).toBe(false)
    const yaml = examYaml(once)
    expect(yaml).toContain('sudo: true')
    expect(yaml).toContain('sudo: false')
    expect(parse(yaml)).toEqual(once)
    const wrong = readExam(yaml.replace('sudo: false', 'sudo: "no"'))
    expect('problem' in wrong && wrong.problem).toContain('se esperaba true o false')
  })

  it('conserva la aserción de cercanía con su ancla y sus líneas', () => {
    const exam = parse(`
exam: "P"
version: 1
hosts: [host1]
groups:
  - group: "G"
    checks:
      - id: kea-red
        description: "KEA declara la subred"
        on: host1
        cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]
        near: { anchor: '"subnet"', lines: 5, contains: "10.0.0.0/8" }
`)
    expect(allChecks(exam)[0].assertion).toEqual({
      kind: 'near',
      value: '10.0.0.0/8',
      anchor: '"subnet"',
      lines: '5'
    })
    expect(examYaml(exam)).toContain('lines: 5')
  })

  it('una comprobación sin comando conserva su valor del alumno', () => {
    const exam = parse(`
exam: "P"
version: 1
hosts: [host1]
groups:
  - group: "Cuestionario"
    checks:
      - id: q-https
        description: "Puerto de HTTPS"
        value: "\${student.p1}"
        equals: "443"
`)
    const [check] = allChecks(exam)
    expect(check.value).toBe('${student.p1}')
    expect(check.cmd).toEqual([])
    // Y al escribirlo no se inventa ningún host ni ningún comando.
    const yaml = examYaml(exam)
    expect(yaml).not.toMatch(/^\s+cmd:/m)
    expect(yaml).not.toMatch(/^\s+on:/m)
  })

  it('un YAML que no se puede leer se dice, no se vacía', () => {
    const read = readExam('exam: "P"\n  mal: [')
    expect('problem' in read).toBe(true)
  })
})

describe('el peso total', () => {
  it('es el denominador que comparten todos los alumnos', () => {
    const exam = parse(readFileSync(join(REPO, 'testdata', 'ra2', 'examen.yaml'), 'utf-8'))
    // Cada comprobación cuenta por su peso, y las que no lo dicen por el de
    // defaults: nunca por cero.
    expect(totalWeight(exam)).toBeGreaterThanOrEqual(checkCount(exam))
  })

  it('una comprobación sin peso vale lo que diga por_defecto', () => {
    const exam = emptyExam('P')
    exam.defaults.weight = '3'
    exam.groups = [{ group: 'G', checks: [emptyCheck('host1'), emptyCheck('host1')] }]
    expect(totalWeight(exam)).toBe(6)
  })
})

describe('lo que no se deja escribir', () => {
  const exam = emptyExam('P')
  const base = (over: Partial<Check> = {}): Check => ({
    ...emptyCheck('host1'),
    id: 'uno',
    description: 'algo',
    cmd: ['hostname'],
    assertion: { kind: 'contains', value: 'x' },
    ...over
  })

  it('acepta una comprobación entera', () => {
    expect(checkProblem(base(), exam, [])).toBeNull()
  })

  it('no deja una comprobación sin identificador ni sin descripción', () => {
    expect(checkProblem(base({ id: '' }), exam, [])).toMatch(/identificador/)
    expect(checkProblem(base({ description: '' }), exam, [])).toMatch(/descripción/)
  })

  it('no deja repetir un identificador: es lo que compara dos correcciones', () => {
    const otra = base()
    expect(checkProblem(base(), exam, [otra, base()])).toMatch(/«uno»/)
  })

  it('no deja una máquina que el examen no declara', () => {
    expect(checkProblem(base({ on: 'host9' }), exam, [])).toMatch(/host9/)
  })

  it('no deja una comprobación sin comando y sin valor', () => {
    expect(checkProblem(base({ cmd: [], value: '' }), exam, [])).toMatch(/comando/)
  })

  it('exige un número en el código de salida y en el peso', () => {
    expect(checkProblem(base({ assertion: { kind: 'exit_code', value: 'cero' } }), exam, [])).toMatch(
      /número/
    )
    expect(checkProblem(base({ weight: '-1' }), exam, [])).toMatch(/peso/)
    expect(checkProblem(base({ weight: '2' }), exam, [])).toBeNull()
  })

  it('exige ancla y líneas en la búsqueda por cercanía', () => {
    const near = base({ assertion: { kind: 'near', value: 'x', anchor: '', lines: '5' } })
    expect(checkProblem(near, exam, [])).toMatch(/anclaje/)
    expect(
      checkProblem(
        base({ assertion: { kind: 'near', value: 'x', anchor: 'a', lines: '5' } }),
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

describe('original YAML format is never silently normalized',()=> {
 const valid='exam: P\nversion: 1\nhosts: [host1]\ndefaults: {weight: 1}\ngroups:\n- group: G\n  checks:\n  - id: c\n    description: C\n    on: host1\n    cmd: ["true"]\n    contains: yes\n'
 it.each([
  valid+'unknown: x\n',
  valid.replace('weight: 1','weight: 1, unknown: x'),
  valid.replace('group: G','group: G\n  unknown: x'),
  valid+'    unknown: x\n',
  valid+'    not_contains: no\n',
  valid.replace('contains: yes','near: {anchor: a, contains: b, lines: 0, unknown: x}'),
  valid.replace('cmd: ["true"]','cmd: false'),
  valid.replace('weight: 1','weight: "1"'),
  valid.replace('description: C','description: [C]')
 ])('refuses unrepresentable data: %s',(yaml)=>expect(readExam(yaml)).toHaveProperty('problem'))
 it('preserves valid meaning',()=>expect(parse(examYaml(parse(valid)))).toEqual(parse(valid)))
})


it.each(['0','0.5','1'])('preserves numeric weight %s in open/save cycle',(peso)=> {
 const exam=emptyExam('P');exam.defaults.weight=peso
 const check={...emptyCheck('host1'),id:'c',description:'C',cmd:['true'],weight:peso,assertion:{kind:'near' as const,value:'yes',anchor:'yes',lines:'0'}}
 exam.groups=[{group:'G',checks:[check]}]
 expect(checkProblem(check,exam,[])).toBeNull()
 expect(parse(examYaml(exam))).toEqual(exam)
 expect(examYaml(exam)).toContain(`weight: ${peso}`)
})
