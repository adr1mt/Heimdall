import { describe, expect, it } from 'vitest'
import { NAV_FOOTER, NAV_MAIN, comingSoon, isReady } from '../src/renderer/src/lib/nav'

describe('navegación', () => {
  it('lleva las siete secciones de trabajo en su orden', () => {
    expect(NAV_MAIN.map((entry) => entry.id)).toEqual([
      'home',
      'classes',
      'exams',
      'correct',
      'results',
      'analytics',
      'history'
    ])
  })

  it('deja Ajustes y Ayuda al pie', () => {
    expect(NAV_FOOTER.map((entry) => entry.id)).toEqual(['settings', 'help'])
  })

  it('no ofrece como abrible una sección que todavía no está', () => {
    for (const id of ['analytics'] as const) expect(isReady(id)).toBe(false)
    for (const id of ['home', 'classes', 'exams', 'correct', 'results', 'history', 'settings', 'help'] as const) {
      expect(isReady(id)).toBe(true)
    }
  })

  it('dice por su nombre qué sección llega más adelante', () => {
    expect(comingSoon('analytics')).toContain('Analíticas')
  })

  it('no repite ninguna entrada entre el cuerpo y el pie', () => {
    const ids = [...NAV_MAIN, ...NAV_FOOTER].map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
