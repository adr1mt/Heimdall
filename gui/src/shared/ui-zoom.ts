/** Shared by Electron's menu guard and the renderer's keyboard handler. */
export function zoomAction(key: string, control: boolean, meta: boolean, alt: boolean): 'in' | 'out' | 'reset' | null {
  if ((!control && !meta) || alt) return null
  if (key === '+' || key === '=' || key === 'Add') return 'in'
  if (key === '-' || key === 'Subtract') return 'out'
  if (key === '0') return 'reset'
  return null
}
