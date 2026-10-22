import { expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const failure = vi.hoisted(() => ({ target: '' }))
vi.mock('node:fs', async original => {
  const fs = await original<typeof import('node:fs')>()
  return { ...fs, renameSync: (...args: Parameters<typeof fs.renameSync>) => {
    if (String(args[1]) === failure.target) throw new Error('simulated publication failure')
    return fs.renameSync(...args)
  } }
})
import { readSourceCopy, sourceCopiesSlot, writeSourceFile } from '../src/main/source-backup'

it('a failure publishing the source preserves both versions and cleans staging', () => {
  const root = mkdtempSync(join(tmpdir(), 'heimdall-source-failure-'))
  try {
    const source = join(root, 'examen.yaml'), data = join(root, 'data')
    writeFileSync(source, 'original')
    failure.target = source
    expect(() => writeSourceFile(data, source, 'exam', 'proposed')).toThrow(/publication failure/)
    expect(readFileSync(source, 'utf8')).toBe('original')
    const slot = sourceCopiesSlot(data, source, 'exam')
    expect(readdirSync(slot).map(name => readSourceCopy(data, join(slot, name), 'exam')).sort()).toEqual(['original', 'proposed'])
    expect(readdirSync(root).some(name => name.startsWith('.heimdall-save-'))).toBe(false)
  } finally {
    failure.target = ''
    rmSync(root, { recursive: true, force: true })
  }
})
