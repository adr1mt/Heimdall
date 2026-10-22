import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let useApp: typeof import('../src/renderer/src/stores/app').useApp

beforeAll(async () => {
  vi.stubGlobal('localStorage', { getItem: () => null })
  ;({ useApp } = await import('../src/renderer/src/stores/app'))
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  useApp.getState().setNotice(null)
  vi.useRealTimers()
})

describe('operational notices', () => {
  it.each(['success', 'info'] as const)('dismisses %s after five seconds', (kind) => {
    useApp.getState().setNotice('Clase guardada.', kind)
    vi.advanceTimersByTime(4999)
    expect(useApp.getState().notice).toBe('Clase guardada.')
    vi.advanceTimersByTime(1)
    expect(useApp.getState().notice).toBeNull()
  })

  it('restarts the full duration when the same confirmation repeats', () => {
    useApp.getState().setNotice('Clase guardada.', 'success')
    vi.advanceTimersByTime(4000)
    useApp.getState().setNotice('Clase guardada.', 'success')
    vi.advanceTimersByTime(1000)
    expect(useApp.getState().notice).toBe('Clase guardada.')
    vi.advanceTimersByTime(4000)
    expect(useApp.getState().notice).toBeNull()
  })

  it('keeps errors visible, including an error replacing a confirmation', () => {
    useApp.getState().setNotice('Clase guardada.', 'success')
    vi.advanceTimersByTime(4000)
    useApp.getState().setNotice('No se pudo guardar la clase')
    vi.advanceTimersByTime(60000)
    expect(useApp.getState().notice).toBe('No se pudo guardar la clase')
    expect(useApp.getState().noticeKind).toBe('error')
  })

  it('cancels the pending dismissal when the teacher closes the notice', () => {
    useApp.getState().setNotice('Clase guardada.', 'success')
    expect(vi.getTimerCount()).toBe(1)
    useApp.getState().setNotice(null)
    expect(useApp.getState().notice).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
})
