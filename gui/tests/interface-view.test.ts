import { beforeEach, describe, expect, it, vi } from 'vitest'

const saved = new Map<string, string>()
const setProperty = vi.fn()
const toggle = vi.fn()

beforeEach(() => {
  vi.resetModules()
  saved.clear()
  setProperty.mockClear()
  toggle.mockClear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value)
  })
  vi.stubGlobal('document', { documentElement: { style: { setProperty }, classList: { toggle } } })
})

describe('teacher display preferences', () => {
  it('starts at full readable size with an adaptive sidebar', async () => {
    const { useApp } = await import('../src/renderer/src/stores/app')
    expect(useApp.getState().uiZoom).toBe(100)
    expect(useApp.getState().sidebar).toBe('auto')
    expect(setProperty).toHaveBeenLastCalledWith('--ui-scale', '1')
  })

  it('restores scale and sidebar after reopening, independently of projector mode', async () => {
    let { useApp } = await import('../src/renderer/src/stores/app')
    useApp.getState().setUiZoom(80)
    useApp.getState().setSidebar('collapsed')
    useApp.getState().toggleProjector()
    expect(useApp.getState().uiZoom).toBe(80)
    expect(saved.get('heimdall-ui-zoom')).toBe('80')
    vi.resetModules()
    ;({ useApp } = await import('../src/renderer/src/stores/app'))
    expect(useApp.getState()).toMatchObject({ uiZoom: 80, sidebar: 'collapsed', projector: true })
    useApp.getState().toggleProjector()
    expect(setProperty).toHaveBeenLastCalledWith('--ui-scale', '0.8')
    useApp.getState().setUiZoom(100)
    expect(setProperty).toHaveBeenLastCalledWith('--ui-scale', '1')
  })

  it.each(['corrupt', 'Infinity', '-20', '300'])('bounds saved scale %s and rejects invalid sidebar values', async (value) => {
    saved.set('heimdall-ui-zoom', value)
    saved.set('heimdall-sidebar', 'invalid')
    const { useApp } = await import('../src/renderer/src/stores/app')
    expect(useApp.getState().uiZoom).toBe(value === '-20' ? 80 : value === '300' ? 120 : 100)
    expect(useApp.getState().sidebar).toBe('auto')
  })
})
