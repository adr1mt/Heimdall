import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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
