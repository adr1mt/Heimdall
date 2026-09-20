import { describe, expect, it } from 'vitest'
import { machineLiterals, maskMachines, maskerFor } from '../src/renderer/src/lib/projector'

describe('modo proyector', () => {
  it('tapa las direcciones IPv4 de una orden', () => {
    const masked = maskMachines('ssh alu1@127.1.2.3 -p 2201 id -u', [])
    expect(masked).not.toContain('127.1.2.3')
    expect(masked).toContain('•••')
    // Lo demás se lee igual: es lo que el profesor explica en clase.
    expect(masked).toContain('id -u')
  })

  it('tapa también los nombres de máquina que nombra el artefacto', () => {
    const literals = machineLiterals(['alu1.aula', '127.1.2.3', 'alumno'])
    const masked = maskMachines('conectando a alu1.aula como alumno', literals)
    expect(masked).not.toContain('alu1.aula')
    expect(masked).not.toContain('alumno')
  })

  it('el nombre más largo se tapa primero y no deja medio nombre a la vista', () => {
    const literals = machineLiterals(['alu1', 'alu10.aula'])
    expect(literals[0]).toBe('alu10.aula')
    expect(maskMachines('host alu10.aula', literals)).not.toContain('.aula')
  })

  it('no toca la salida del alumno más allá de la máquina', () => {
    const masked = maskMachines('uid=1000(alumno) gid=1000', machineLiterals(['127.1.2.3']))
    expect(masked).toBe('uid=1000(alumno) gid=1000')
  })

  it('ignora literales demasiado cortos para sustituir sin destrozar texto', () => {
    expect(machineLiterals(['ab', undefined, 'abc'])).toEqual(['abc'])
  })

  it('fuera del proyector no cambia ni un carácter', () => {
    const text = 'ssh alu1@127.1.2.3'
    expect(maskerFor(false, machineLiterals(['127.1.2.3']))(text)).toBe(text)
    expect(maskerFor(true, machineLiterals(['127.1.2.3']))(text)).not.toBe(text)
  })
})
