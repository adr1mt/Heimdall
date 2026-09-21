import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeGeneratedAula } from '../src/main/aula'
import { GENERATED_MARK, aulaFileName, aulaYaml, isGeneratedName } from '../src/shared/aula'
import type { ClassGroup } from '../src/shared/classes'

function project(): string {
  return mkdtempSync(join(tmpdir(), 'heimdall-project-'))
}

function group(over: Partial<ClassGroup> = {}): ClassGroup {
  return {
    id: 'c-2smxc',
    name: '2SMX C',
    columns: [],
    students: [
      { id: 'alu1', name: 'Alumna Uno', contact: 'alu1@ficticio', host: '10.0.0.11', port: '', user: 'alumno', fields: {} },
      { id: 'alu2', name: 'Alumne Dos', contact: '', host: '10.0.0.12', port: '2222', user: 'profe', fields: {} }
    ],
    ...over
  }
}

describe('el nombre del aula generada', () => {
  it('es siempre el mismo para la misma clase', () => {
    expect(aulaFileName(group())).toBe(aulaFileName(group({ name: 'otro nombre' })))
  })

  it('cambia con la clase', () => {
    expect(aulaFileName(group())).not.toBe(aulaFileName(group({ id: 'c-2smxd' })))
  })

  // ADR-0022 §2: el prefijo reservado ES la garantía.
  it('no puede confundirse con un aula escrita a mano', () => {
    expect(isGeneratedName('aula.yaml')).toBe(false)
    expect(isGeneratedName('aula-2smx-c.yaml')).toBe(false)
    expect(isGeneratedName(aulaFileName(group()))).toBe(true)
  })
})

describe('el aula generada', () => {
  it('lleva la marca de que la escribió la aplicación', () => {
    expect(aulaYaml(group()).startsWith(GENERATED_MARK)).toBe(true)
  })

  it('nombra la clase y a cada alumno con su máquina', () => {
    const yaml = aulaYaml(group())
    expect(yaml).toContain('aula: "2SMX C"')
    expect(yaml).toContain('id: "alu1"')
    expect(yaml).toContain('ip: "10.0.0.11"')
    expect(yaml).toContain('usuario: "alumno"')
  })

  it('deja el usuario también en el alumno, para «${alumno.usuario}»', () => {
    // Un examen que compara con el usuario del alumno es de lo más corriente:
    // si el usuario solo estuviera en el host, ese examen no se podría
    // corregir desde una clase.
    const yaml = aulaYaml(group())
    expect(yaml).toMatch(/^ {4}usuario: "alumno"$/m)
  })

  it('solo escribe el puerto del alumno que no usa el de siempre', () => {
    const yaml = aulaYaml(group())
    expect(yaml).toContain('puerto: 2222')
    expect(yaml.match(/puerto: /g)).toHaveLength(2) // el común y el del alumno
  })

  // ADR-0009: el aula nombra la credencial, nunca la lleva.
  it('nombra la contraseña y no la escribe', () => {
    const yaml = aulaYaml(group())
    expect(yaml).toContain('password_ref: "${AULA_PASSWORD}"')
    expect(yaml).not.toMatch(/^\s*password:/m)
  })

  it('entrecomilla un nombre que cambiaría lo que significa el fichero', () => {
    const yaml = aulaYaml(group({ name: 'Grupo: el de las 8 # turno' }))
    expect(yaml).toContain('aula: "Grupo: el de las 8 # turno"')
  })

  it('el contacto viaja solo cuando lo hay', () => {
    const yaml = aulaYaml(group())
    expect(yaml).toContain('moodle_id: "alu1@ficticio"')
    expect(yaml.match(/moodle_id:/g)).toHaveLength(1)
  })
})

describe('las columnas propias del profesor', () => {
  function withColumns(): ClassGroup {
    const g = group({ columns: ['subdominio', 'p1'] })
    g.students[0].fields = { subdominio: 'uno.example', p1: '8080' }
    g.students[1].fields = { subdominio: 'dos.example' }
    return g
  }

  // Es lo que alcanza ${alumno.subdominio} en el examen.
  it('viajan al aula como campos del alumno', () => {
    const yaml = aulaYaml(withColumns())
    expect(yaml).toContain('    subdominio: "uno.example"')
    expect(yaml).toContain('    p1: "8080"')
  })

  it('una columna que un alumno no tiene no se escribe vacía', () => {
    const yaml = aulaYaml(withColumns())
    expect(yaml.match(/p1:/g)).toHaveLength(1)
  })
})

describe('escribir el aula en la carpeta del examen', () => {
  it('la deja con su nombre reservado y devuelve cuál es', () => {
    const dir = project()
    const name = writeGeneratedAula(dir, group())
    expect(name).toBe(aulaFileName(group()))
    expect(readFileSync(join(dir, name), 'utf-8')).toContain('aula: "2SMX C"')
  })

  it('no toca un aula escrita a mano que esté en la misma carpeta', () => {
    const dir = project()
    writeFileSync(join(dir, 'aula.yaml'), 'aula: "la mía"\n', 'utf-8')
    writeGeneratedAula(dir, group())
    expect(readFileSync(join(dir, 'aula.yaml'), 'utf-8')).toBe('aula: "la mía"\n')
  })

  it('se rehace cuando la clase cambia', () => {
    const dir = project()
    const name = writeGeneratedAula(dir, group())
    const moved = group()
    moved.students[0].host = '10.0.0.99'
    writeGeneratedAula(dir, moved)
    expect(readFileSync(join(dir, name), 'utf-8')).toContain('ip: "10.0.0.99"')
  })

  it('dos clases conviven en la carpeta del mismo examen', () => {
    const dir = project()
    const c = writeGeneratedAula(dir, group())
    const d = writeGeneratedAula(dir, group({ id: 'c-2smxd', name: '2SMX D' }))
    expect(c).not.toBe(d)
    expect(readFileSync(join(dir, c), 'utf-8')).toContain('aula: "2SMX C"')
    expect(readFileSync(join(dir, d), 'utf-8')).toContain('aula: "2SMX D"')
  })

  it('se niega antes que pisar un fichero con su nombre que no escribió', () => {
    const dir = project()
    writeFileSync(join(dir, aulaFileName(group())), 'aula: "escrita a mano"\n', 'utf-8')
    expect(() => writeGeneratedAula(dir, group())).toThrow(/no lo escribió Heimdall/i)
    expect(readFileSync(join(dir, aulaFileName(group())), 'utf-8')).toBe('aula: "escrita a mano"\n')
  })
})
