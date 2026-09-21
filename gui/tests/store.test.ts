import { afterEach, describe, expect, it } from 'vitest'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSettings, settingsFile, writeSettings } from '../src/main/store'

function emptyDir(): string {
  return mkdtempSync(join(tmpdir(), 'heimdall-settings-'))
}

describe('settings', () => {
  it('falls back to the engine on the PATH when there is nothing saved', () => {
    expect(readSettings(emptyDir()).enginePath).toBe('heimdall')
  })

  it('reads back what was written', () => {
    const dir = emptyDir()
    writeSettings(dir, { enginePath: '/opt/heimdall/bin/heimdall' })
    expect(readSettings(dir).enginePath).toBe('/opt/heimdall/bin/heimdall')
  })

  it('opens with the defaults when the file is corrupt', () => {
    const dir = emptyDir()
    writeFileSync(settingsFile(dir), '{ esto no es json', 'utf-8')
    expect(readSettings(dir).enginePath).toBe('heimdall')
  })

  it('ignores an empty path instead of leaving the engine unreachable', () => {
    const dir = emptyDir()
    writeFileSync(settingsFile(dir), JSON.stringify({ enginePath: '   ' }), 'utf-8')
    expect(readSettings(dir).enginePath).toBe('heimdall')
  })

  it('writes readable json', () => {
    const dir = emptyDir()
    writeSettings(dir, { enginePath: 'heimdall' })
    expect(JSON.parse(readFileSync(settingsFile(dir), 'utf-8'))).toEqual({ enginePath: 'heimdall' })
  })
})

describe('settings with the engine inside the application', () => {
  const original = process.resourcesPath

  function packagedWithEngine(): string {
    const resources = mkdtempSync(join(tmpdir(), 'heimdall-resources-'))
    const engine = join(resources, 'heimdall')
    writeFileSync(engine, '#!/bin/sh\necho "heimdall 9.9.9"\n', 'utf-8')
    chmodSync(engine, 0o755)
    Object.defineProperty(process, 'resourcesPath', { value: resources, configurable: true })
    return engine
  }

  afterEach(() => {
    Object.defineProperty(process, 'resourcesPath', { value: original, configurable: true })
  })

  it('uses it when nothing is saved, so no system engine is needed', () => {
    const engine = packagedWithEngine()
    expect(readSettings(emptyDir()).enginePath).toBe(engine)
  })

  it('also uses it over a saved bare name from an older install', () => {
    const engine = packagedWithEngine()
    const dir = emptyDir()
    writeSettings(dir, { enginePath: 'heimdall' })
    expect(readSettings(dir).enginePath).toBe(engine)
  })

  it('never overrides an engine the teacher chose', () => {
    packagedWithEngine()
    const dir = emptyDir()
    writeSettings(dir, { enginePath: '/opt/heimdall/bin/heimdall' })
    expect(readSettings(dir).enginePath).toBe('/opt/heimdall/bin/heimdall')
  })
})
