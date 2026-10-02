import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const css = readFileSync(join(__dirname, '../src/renderer/src/styles/globals.css'), 'utf8')
function rgb(value: string): number[] {
  const [h, s, l] = value.split(' ').map(v => parseFloat(v)), light = l / 100, chroma = (1 - Math.abs(2 * light - 1)) * s / 100, x = chroma * (1 - Math.abs((h / 60) % 2 - 1)), m = light - chroma / 2
  const channels = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x]
  return channels.map(c => c + m)
}
const luminance = (c: number[]): number => c.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0)
function contrast(a: number[], b: number[]): number { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05) }
it.each(['light', 'dark'])('has AA contrast for sidebar and destructive actions in %s', theme => {
  const tokens = new Map<string, string>()
  const root = css.slice(css.indexOf(':root'), css.indexOf('.dark'))
  const dark = css.slice(css.indexOf('.dark'), css.indexOf('  * {'))
  for (const part of [root, ...(theme === 'dark' ? [dark] : [])]) for (const m of part.matchAll(/--([a-z-]+):\s*([^;]+);/g)) tokens.set(m[1], m[2])
  const color = (key: string): number[] => rgb(tokens.get(key)!)
  for (const key of ['sidebar-success', 'sidebar-destructive']) for (const alpha of [0.1, 0.2]) {
    const fg = color(key), base = color('sidebar'), bg = fg.map((v, i) => v * alpha + base[i] * (1 - alpha))
    expect(contrast(fg, bg), `${theme} ${key} alpha=${alpha}`).toBeGreaterThanOrEqual(4.5)
  }
  for (const key of ['destructive', 'destructive-hover']) expect(contrast(color(key), color('destructive-foreground')), `${theme} ${key}`).toBeGreaterThanOrEqual(4.5)
})
