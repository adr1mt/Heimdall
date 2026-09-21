import { describe, expect, it } from 'vitest'
import { t } from '@/i18n/es'

// Lo único que se lee sin abrir un bloque técnico es su renglón. Que diga
// cuántos hay, y en singular cuando es uno, es la mitad de para qué sirve:
// «1 aviso técnico» se decide de un vistazo, «avisos (1)» no.
describe('renglón de los bloques técnicos', () => {
  it('cuenta los avisos del motor y distingue el singular', () => {
    expect(t.results.warningsFolded(1)).toBe('1 aviso técnico')
    expect(t.results.warningsFolded(3)).toBe('3 avisos técnicos')
  })

  it('dice a cuántos alumnos les falta algo por comprobar', () => {
    expect(t.pending.folded(1)).toBe('1 alumno con algo sin comprobar')
    expect(t.pending.folded(2)).toBe('2 alumnos con algo sin comprobar')
  })
})
