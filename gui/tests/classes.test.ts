import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classesFile, readClasses, writeClasses } from '../src/main/classes'
import {
  columnProblem,
  duplicateOf,
  groupLine,
  problemWith,
  readGroup,
  type ClassGroup
} from '../src/shared/classes'

function emptyDir(): string {
  return mkdtempSync(join(tmpdir(), 'heimdall-classes-'))
}

function group(over: Partial<ClassGroup> = {}): ClassGroup {
  return {
    id: 'g1',
    name: '2SMX A',
    columns: [],
    students: [
      {
        id: 'alu1',
        name: 'Alumna Uno',
        contact: 'alu1@ficticio',
        host: '127.1.2.3',
        port: '',
        user: 'alumno',
        fields: {}
      }
    ],
    ...over
  }
}

describe('el fichero de clases', () => {
  it('no tiene ninguna clase cuando todavía no se ha guardado nada', () => {
    expect(readClasses(emptyDir())).toEqual([])
  })

  it('devuelve lo que se guardó', () => {
    const dir = emptyDir()
    writeClasses(dir, [group()])
    expect(readClasses(dir)).toEqual([group()])
  })

  it('avisa en vez de perder el trabajo cuando el fichero no se puede leer', () => {
    const dir = emptyDir()
    writeFileSync(classesFile(dir), '{ esto no es json', 'utf-8')
    expect(() => readClasses(dir)).toThrow(/no se pudo leer/i)
  })

  it('no sobrescribe un fichero que no se puede leer', () => {
    const dir = emptyDir()
    writeFileSync(classesFile(dir), '{ esto no es json', 'utf-8')
    expect(() => writeClasses(dir, [group()])).toThrow()
    expect(readFileSync(classesFile(dir), 'utf-8')).toBe('{ esto no es json')
  })

  it('rechaza un fichero con la forma equivocada en vez de darlo por vacío', () => {
    const dir = emptyDir()
    writeFileSync(classesFile(dir), JSON.stringify({ clases: [] }), 'utf-8')
    expect(() => readClasses(dir)).toThrow(/forma esperada/i)
  })

  // ADR-0009 y ADR-0021 §4: la garantía es estructural, no un filtro.
  it('no escribe ninguna contraseña, ni aunque se la manden', () => {
    const dir = emptyDir()
    const contaminated = {
      ...group(),
      password: 'secreta',
      students: [{ ...group().students[0], password: 'secreta' }]
    } as unknown as ClassGroup
    writeClasses(dir, [contaminated])
    expect(readFileSync(classesFile(dir), 'utf-8')).not.toContain('secreta')
  })

  it('descarta una contraseña que alguien escribiera a mano en el fichero', () => {
    const dir = emptyDir()
    writeFileSync(
      classesFile(dir),
      JSON.stringify({
        classes: [{ ...group(), students: [{ ...group().students[0], password: 'secreta' }] }]
      }),
      'utf-8'
    )
    expect(JSON.stringify(readClasses(dir))).not.toContain('secreta')
  })

  it('una clase sobrevive a cerrar la aplicación', () => {
    const dir = emptyDir()
    writeClasses(dir, [group(), group({ id: 'g2', name: '1SMX B' })])
    // Otro arranque: nada en memoria, solo el fichero.
    expect(readClasses(dir).map((g) => g.name)).toEqual(['2SMX A', '1SMX B'])
  })

  it('borrar una clase deja las demás intactas', () => {
    const dir = emptyDir()
    writeClasses(dir, [group(), group({ id: 'g2', name: '1SMX B' })])
    writeClasses(dir, readClasses(dir).filter((g) => g.id !== 'g1'))
    expect(readClasses(dir).map((g) => g.id)).toEqual(['g2'])
  })
})

describe('leer una clase', () => {
  it('descarta una fila sin identificador: el examen no tendría cómo llamarla', () => {
    const read = readGroup({ ...group(), students: [{ name: 'Sin identificador' }] })
    expect(read?.students).toEqual([])
  })

  it('descarta una clase sin nombre', () => {
    expect(readGroup({ id: 'g1', name: '   ', students: [] })).toBeNull()
  })
})

describe('las columnas propias del profesor', () => {
  it('se guardan y se recuperan con lo que tiene cada alumno', () => {
    const dir = emptyDir()
    const g = group({ columns: ['subdominio'] })
    g.students[0].fields = { subdominio: 'uno.example' }
    writeClasses(dir, [g])
    expect(readClasses(dir)[0].students[0].fields).toEqual({ subdominio: 'uno.example' })
  })

  // Una columna con uno de estos nombres pisaría la identidad del alumno en
  // el aula sin que nadie lo dijera.
  it('no pueden llamarse como una clave que ya usa el aula', () => {
    for (const name of ['id', 'nombre', 'moodle_id', 'excluido', 'hosts']) {
      expect(columnProblem(name, [])).not.toBeNull()
    }
  })

  it('una columna reservada no sobrevive a la lectura', () => {
    const read = readGroup({ ...group(), columns: ['nombre', 'subdominio'] })
    expect(read?.columns).toEqual(['subdominio'])
  })

  it('un campo reservado no sobrevive a la lectura', () => {
    const read = readGroup({
      ...group(),
      students: [{ ...group().students[0], fields: { nombre: 'pisado', subdominio: 'ok' } }]
    })
    expect(read?.students[0].fields).toEqual({ subdominio: 'ok' })
  })

  it('rechaza un nombre que no vale como clave', () => {
    expect(columnProblem('Sub Dominio', [])).toMatch(/min[úu]sculas/i)
    expect(columnProblem('2p', [])).not.toBeNull()
    expect(columnProblem('', [])).toMatch(/nombre/i)
  })

  it('no deja repetir una columna', () => {
    expect(columnProblem('subdominio', ['subdominio'])).toMatch(/ya está/i)
  })

  it('acepta un nombre normal', () => {
    expect(columnProblem('subdominio', [])).toBeNull()
    expect(columnProblem('p10', [])).toBeNull()
  })
})

describe('antes de guardar una clase', () => {
  it('acepta una clase completa', () => {
    expect(problemWith(group(), [])).toBeNull()
  })

  it('no deja guardarla sin nombre', () => {
    expect(problemWith(group({ name: '  ' }), [])).toMatch(/nombre/i)
  })

  it('no deja dos clases con el mismo nombre', () => {
    const problem = problemWith(group({ id: 'g2' }), [group()])
    expect(problem).toMatch(/2SMX A/)
  })

  it('no deja guardarla vacía', () => {
    expect(problemWith(group({ students: [] }), [])).toMatch(/ningún alumno/i)
  })

  it('señala al alumno al que le falta la máquina, por su identificador', () => {
    const broken = group({ students: [{ ...group().students[0], host: '' }] })
    expect(problemWith(broken, [])).toMatch(/alu1/)
  })

  it('señala al alumno al que le falta el usuario', () => {
    const broken = group({ students: [{ ...group().students[0], user: '' }] })
    expect(problemWith(broken, [])).toMatch(/alu1/)
  })

  it('no deja repetir un identificador', () => {
    const twice = group({ students: [group().students[0], { ...group().students[0] }] })
    expect(problemWith(twice, [])).toMatch(/repetido/i)
  })
})

describe('duplicar una clase', () => {
  it('sale con su propio identificador y su propio nombre', () => {
    const copy = duplicateOf(group(), [group()], 'g2')
    expect(copy.id).toBe('g2')
    expect(copy.name).toBe('2SMX A (copia)')
    expect(copy.students).toEqual(group().students)
  })

  it('busca un nombre libre cuando la copia ya existe', () => {
    const first = duplicateOf(group(), [group()], 'g2')
    expect(duplicateOf(group(), [group(), first], 'g3').name).toBe('2SMX A (copia 2)')
  })

  it('los alumnos son copias: tocar la copia no toca el original', () => {
    const original = group()
    original.students[0].fields = { subdominio: 'uno.example' }
    const copy = duplicateOf(original, [original], 'g2')
    copy.students[0].name = 'Otro nombre'
    copy.students[0].fields.subdominio = 'otro.example'
    expect(original.students[0].name).toBe('Alumna Uno')
    expect(original.students[0].fields.subdominio).toBe('uno.example')
  })
})

describe('la línea que dice qué clase hay elegida', () => {
  it('dice el nombre y cuántos alumnos', () => {
    expect(groupLine(group())).toBe('2SMX A · 1 alumno')
  })

  it('en plural cuando hay más de uno', () => {
    const two = group({ students: [group().students[0], { ...group().students[0], id: 'alu2' }] })
    expect(groupLine(two)).toBe('2SMX A · 2 alumnos')
  })
})
