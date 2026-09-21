import { describe, expect, it } from 'vitest'
import { duplicatesIn, readPaste, separatorOf, studentsOf } from '../src/shared/paste'
import { emptyStudent } from '../src/shared/classes'

/** Lo que sale de copiar seis columnas de una hoja de cálculo. */
const SHEET = [
  'alu1\tAlumna Uno\talu1@ficticio\t10.0.0.1\t2201\talumno',
  'alu2\tAlumne Dos\talu2@ficticio\t10.0.0.2\t\talumno',
  'alu3\tAlumno Tres\talu3@ficticio\t10.0.0.3\t22\talumno'
].join('\n')

describe('pegar una clase', () => {
  it('crea la clase entera de un pegado de varias columnas', () => {
    const paste = readPaste(SHEET, [])
    expect(paste.rows).toHaveLength(3)
    const students = studentsOf(paste, [])
    expect(students).toHaveLength(3)
    expect(students[0]).toEqual({
      id: 'alu1',
      name: 'Alumna Uno',
      contact: 'alu1@ficticio',
      host: '10.0.0.1',
      port: '2201',
      user: 'alumno',
      fields: {}
    })
    // Sin puerto se queda vacío, que es «el de siempre», no un cero.
    expect(students[1].port).toBe('')
  })

  it('entiende la cabecera en español, en el orden que venga', () => {
    const paste = readPaste(
      ['Nombre;Identificador;Usuario;Máquina', 'Alumna Uno;alu1;alumno;10.0.0.1'].join('\n'),
      []
    )
    expect(studentsOf(paste, [])[0]).toMatchObject({
      id: 'alu1',
      name: 'Alumna Uno',
      user: 'alumno',
      host: '10.0.0.1'
    })
  })

  it('lee las columnas propias del profesor por su nombre', () => {
    const paste = readPaste(
      ['id\tnombre\tmaquina\tusuario\tsubdominio', 'alu1\tAlumna Uno\t10.0.0.1\talumno\tuno.lan'].join('\n'),
      ['subdominio']
    )
    expect(studentsOf(paste, [])[0].fields).toEqual({ subdominio: 'uno.lan' })
    expect(paste.newColumns).toEqual([])
  })

  it('avisa de una columna propia que la clase todavía no tiene', () => {
    const paste = readPaste(
      ['id\tnombre\tmaquina\tusuario\tpuertos', 'alu1\tAlumna Uno\t10.0.0.1\talumno\t8080'].join('\n'),
      []
    )
    expect(paste.newColumns).toEqual(['puertos'])
  })

  it('sin cabecera lee las columnas en el orden de la tabla', () => {
    const paste = readPaste('alu1\tAlumna Uno\t\t10.0.0.1\t\talumno\tuno.lan', ['subdominio'])
    expect(studentsOf(paste, [])[0].fields).toEqual({ subdominio: 'uno.lan' })
  })
})

describe('una fila incompleta', () => {
  it('se señala antes de guardar y no se guarda a medias', () => {
    const paste = readPaste(['alu1\tAlumna Uno\t\t10.0.0.1\t\talumno', 'alu2\t\t\t\t\t'].join('\n'), [])
    expect(paste.rows[0].missing).toEqual([])
    expect(paste.rows[1].missing).toEqual(['nombre', 'dirección de la máquina', 'usuario'])
    // Se enseña, pero no entra: nadie acaba con medio alumno guardado.
    const students = studentsOf(paste, [])
    expect(students).toHaveLength(1)
    expect(students[0].id).toBe('alu1')
  })

  it('dice qué falta con su nombre de pantalla, no con el del campo', () => {
    const [row] = readPaste('\tAlumna Uno\t\t10.0.0.1\t\talumno', []).rows
    expect(row.missing).toEqual(['identificador'])
  })
})

describe('una contraseña pegada', () => {
  it('no se lee, se diga como se diga, y se avisa', () => {
    for (const name of ['password', 'contraseña', 'clave']) {
      const paste = readPaste(
        [`id\tnombre\tmaquina\tusuario\t${name}`, 'alu1\tAlumna Uno\t10.0.0.1\talumno\tsecreta'].join('\n'),
        []
      )
      const [student] = studentsOf(paste, [])
      expect(JSON.stringify(student)).not.toContain('secreta')
      expect(paste.newColumns).toEqual([])
      expect(paste.warnings.join(' ')).toContain(name)
    }
  })
})

describe('identificadores repetidos', () => {
  it('no duplican a un alumno que ya está en la clase', () => {
    const already = { ...emptyStudent(), id: 'alu1', name: 'Alumna Uno', host: '10.0.0.1', user: 'alumno' }
    const paste = readPaste(SHEET, [])
    expect(studentsOf(paste, [already]).map((s) => s.id)).toEqual(['alu2', 'alu3'])
    expect(duplicatesIn(paste, [already])).toBe(1)
  })

  it('tampoco se repiten dentro del propio pegado', () => {
    const paste = readPaste(
      ['alu1\tAlumna Uno\t\t10.0.0.1\t\talumno', 'alu1\tOtra\t\t10.0.0.9\t\talumno'].join('\n'),
      []
    )
    expect(studentsOf(paste, [])).toHaveLength(1)
    expect(duplicatesIn(paste, [])).toBe(1)
  })
})

describe('el separador', () => {
  it('es el tabulador cuando lo hay: un nombre con coma es de lo más normal', () => {
    expect(separatorOf('a\tb,c')).toBe('\t')
    expect(readPaste('alu1\tPérez Gil, Ana\t\t10.0.0.1\t\talumno', []).rows[0].student.name).toBe(
      'Pérez Gil, Ana'
    )
  })

  it('entiende el punto y coma del Excel en español', () => {
    expect(separatorOf('a;b')).toBe(';')
  })

  it('no saca nada de un pegado vacío', () => {
    expect(readPaste('   \n\n', []).rows).toEqual([])
  })
})
