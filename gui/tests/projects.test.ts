import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  EXAM_FILE,
  createProjectAt,
  forgetProject,
  openProjectAt,
  projectsFile,
  readRecents,
  rememberProject
} from '../src/main/projects'
import { canOpen, needsProject } from '../src/renderer/src/lib/nav'

/** The application's data directory, where the list of recents lives. */
function dataDir(): string {
  return mkdtempSync(join(tmpdir(), 'heimdall-projects-'))
}

/** A project folder, with an exam in it unless asked otherwise. */
function projectDir(exam: string | null = 'examen: "Examen de prueba"\n'): string {
  const dir = mkdtempSync(join(tmpdir(), 'heimdall-project-'))
  if (exam !== null) writeFileSync(join(dir, EXAM_FILE), exam, 'utf-8')
  return dir
}

describe('abrir un proyecto', () => {
  it('resuelve el examen de la carpeta sin que se elija ningún fichero', () => {
    const dir = projectDir()
    const project = openProjectAt(dir)
    expect(project.examPath).toBe(join(dir, EXAM_FILE))
  })

  it('lo llama como el profesor llamó al examen', () => {
    expect(openProjectAt(projectDir('examen: "RA2 · Servicios de red"\n')).name).toBe(
      'RA2 · Servicios de red'
    )
  })

  it('cae en el nombre de la carpeta cuando el examen no dice cómo se llama', () => {
    const dir = projectDir('# sin nombre\n')
    expect(openProjectAt(dir).name).toBe(dir.split('/').pop())
  })

  it('dice qué falta cuando la carpeta no es un proyecto, y no inventa uno', () => {
    const dir = projectDir(null)
    expect(() => openProjectAt(dir)).toThrow(/examen\.yaml/)
    expect(existsSync(join(dir, EXAM_FILE))).toBe(false)
  })
})

describe('crear un proyecto', () => {
  it('deja un examen que se puede corregir tal cual', () => {
    const dir = projectDir(null)
    const project = createProjectAt(dir)
    const exam = readFileSync(project.examPath, 'utf-8')
    expect(exam).toContain('examen:')
    expect(exam).toContain('grupos:')
    expect(exam).toContain('comprobaciones:')
    // Y se abre como cualquier otro: crear y abrir dan lo mismo.
    expect(openProjectAt(dir).examPath).toBe(project.examPath)
  })

  it('nunca pisa el examen que ya estaba', () => {
    const dir = projectDir('examen: "El de verdad"\n')
    expect(() => createProjectAt(dir)).toThrow(/ya tiene un examen/)
    expect(readFileSync(join(dir, EXAM_FILE), 'utf-8')).toContain('El de verdad')
  })

  it('crea la carpeta si todavía no existe', () => {
    const dir = join(dataDir(), 'examen nuevo')
    expect(createProjectAt(dir).name).toBe('examen nuevo')
    expect(existsSync(join(dir, EXAM_FILE))).toBe(true)
  })
})

describe('la lista de exámenes recientes', () => {
  it('no tiene nada antes de abrir el primero', () => {
    expect(readRecents(dataDir())).toEqual([])
  })

  it('sobrevive al cierre de la aplicación', () => {
    const data = dataDir()
    const dir = projectDir()
    rememberProject(data, openProjectAt(dir))
    // Otra ejecución: nada en memoria, solo el fichero en el disco.
    expect(readRecents(data)).toEqual([{ dir, name: 'Examen de prueba' }])
  })

  it('pone el último arriba y no repite el mismo proyecto', () => {
    const data = dataDir()
    const uno = openProjectAt(projectDir('examen: "Uno"\n'))
    const dos = openProjectAt(projectDir('examen: "Dos"\n'))
    rememberProject(data, uno)
    rememberProject(data, dos)
    rememberProject(data, uno)
    expect(readRecents(data).map((recent) => recent.name)).toEqual(['Uno', 'Dos'])
  })

  it('no crece sin fin: se queda con los diez últimos', () => {
    const data = dataDir()
    for (let i = 0; i < 14; i++) {
      rememberProject(data, { dir: `/exámenes/${i}`, name: `Examen ${i}`, examPath: '' })
    }
    const recent = readRecents(data)
    expect(recent).toHaveLength(10)
    expect(recent[0].name).toBe('Examen 13')
  })

  it('quitar uno de la lista no toca su carpeta ni su examen', () => {
    const data = dataDir()
    const dir = projectDir()
    rememberProject(data, openProjectAt(dir))
    expect(forgetProject(data, dir)).toEqual([])
    expect(existsSync(join(dir, EXAM_FILE))).toBe(true)
  })

  it('una lista ilegible no impide abrir la aplicación', () => {
    const data = dataDir()
    writeFileSync(projectsFile(data), 'esto no es json', 'utf-8')
    expect(readRecents(data)).toEqual([])
  })

  it('se escribe de una pieza: no queda a medias', () => {
    const data = join(dataDir(), 'todavía', 'no', 'existe')
    mkdirSync(data, { recursive: true })
    rememberProject(data, { dir: '/x', name: 'X', examPath: '' })
    expect(JSON.parse(readFileSync(projectsFile(data), 'utf-8')).recent).toHaveLength(1)
  })
})

describe('sin ningún examen abierto', () => {
  it('no se puede entrar en lo que es de un examen concreto', () => {
    for (const view of ['correct', 'results', 'history'] as const) {
      expect(needsProject(view)).toBe(true)
      expect(canOpen(view, false)).toBe(false)
      expect(canOpen(view, true)).toBe(true)
    }
  })

  it('Inicio, Clases, Ajustes y Ayuda siguen abriéndose', () => {
    for (const view of ['home', 'classes', 'settings', 'help'] as const) {
      expect(canOpen(view, false)).toBe(true)
    }
  })

  it('un examen abierto no resucita una sección que todavía no está', () => {
    for (const view of ['exams', 'analytics'] as const) expect(canOpen(view, true)).toBe(false)
  })
})
