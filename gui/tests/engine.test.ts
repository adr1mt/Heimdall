import { describe, expect, it } from 'vitest'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bundledEnginePath, detectEngine, parseEngineVersion } from '../src/main/engine'

function fakeEngine(name: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'heimdall-gui-'))
  const path = join(dir, name)
  writeFileSync(path, `#!/bin/sh\n${body}\n`, 'utf-8')
  chmodSync(path, 0o755)
  return path
}

describe('parseEngineVersion', () => {
  it('reads the version out of the line the engine prints', () => {
    expect(parseEngineVersion('heimdall 1.0.0\n')).toBe('1.0.0')
  })

  it('does not take another program for the engine', () => {
    expect(parseEngineVersion('ruby 3.2.2\n')).toBeNull()
    expect(parseEngineVersion('')).toBeNull()
  })
})

describe('detectEngine', () => {
  it('accepts an engine that identifies itself', async () => {
    const path = fakeEngine('heimdall', 'echo "heimdall 9.9.9"')
    const status = await detectEngine(path)
    expect(status).toEqual({ found: true, path, version: '9.9.9', problem: null })
  })

  it('reads the version even when it comes out on stderr', async () => {
    const path = fakeEngine('heimdall', 'echo "heimdall 9.9.9" >&2')
    expect((await detectEngine(path)).version).toBe('9.9.9')
  })

  it('says so when there is no binary there', async () => {
    const status = await detectEngine(join(tmpdir(), 'no-existe-heimdall'))
    expect(status.found).toBe(false)
    expect(status.version).toBeNull()
    expect(status.problem).toContain('No se encuentra el motor')
  })

  it('rejects a program that is not the engine', async () => {
    const path = fakeEngine('otro', 'echo "ruby 3.2.2"')
    const status = await detectEngine(path)
    expect(status.found).toBe(false)
    expect(status.problem).toContain('no es Heimdall')
  })

  it('rejects an engine that fails without identifying itself', async () => {
    const path = fakeEngine('roto', 'exit 1')
    expect((await detectEngine(path)).found).toBe(false)
  })
})

describe('bundledEnginePath', () => {
  it('finds the engine that travels inside the application', () => {
    const path = fakeEngine('heimdall', 'echo "heimdall 9.9.9"')
    const resources = join(path, '..')
    expect(bundledEnginePath(resources)).toBe(join(resources, 'heimdall'))
  })

  it('answers nothing when the application carries no engine', () => {
    expect(bundledEnginePath(mkdtempSync(join(tmpdir(), 'heimdall-sin-motor-')))).toBeNull()
  })

  it('answers nothing when there are no resources at all', () => {
    expect(bundledEnginePath(undefined)).toBeNull()
  })

  it('does not take a file without execute permission for the engine', () => {
    const path = fakeEngine('heimdall', 'echo "heimdall 9.9.9"')
    chmodSync(path, 0o644)
    expect(bundledEnginePath(join(path, '..'))).toBeNull()
  })
})
