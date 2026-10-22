import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_SOURCE_BYTES, MAX_SOURCE_VERSIONS, readSourceCopy, sourceCopiesRoot, sourceCopiesSlot, writeSourceFile } from '../src/main/source-backup'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'heimdall-sources-')); roots.push(root)
  const data = join(root, 'data'), source = join(root, 'examen.yaml')
  const slot = sourceCopiesSlot(data, source, 'exam')
  const copies = () => readdirSync(slot).filter(name => name.endsWith('.json')).map(name => join(slot, name))
  return { root, data, source, slot, copies }
}

describe('source versions', () => {
  it('keeps first, previous and current bytes privately, deduplicating unchanged saves', () => {
    const f = fixture()
    writeSourceFile(f.data, f.source, 'exam', 'examen: "áéí"\n')
    writeSourceFile(f.data, f.source, 'exam', 'examen: nuevo\n')
    writeSourceFile(f.data, f.source, 'exam', 'examen: nuevo\n')
    expect(f.copies()).toHaveLength(2)
    expect(f.copies().map(path => readSourceCopy(f.data, path, 'exam')).sort()).toEqual(['examen: "áéí"\n', 'examen: nuevo\n'].sort())
    for (const path of [f.data, sourceCopiesRoot(f.data), f.slot]) expect(statSync(path).mode & 0o777).toBe(0o700)
    for (const path of [...f.copies(), f.source]) expect(statSync(path).mode & 0o777).toBe(0o600)
  })

  it('keeps at most 50 versions without pruning the current original', () => {
    const f = fixture()
    for (let i = 0; i < MAX_SOURCE_VERSIONS + 3; i++) writeSourceFile(f.data, f.source, 'exam', `version-${i}`)
    expect(f.copies()).toHaveLength(MAX_SOURCE_VERSIONS)
    const texts = f.copies().map(path => readSourceCopy(f.data, path, 'exam'))
    expect(texts).toContain('version-51'); expect(texts).toContain('version-52')
  })

  it('refuses corruption, wrong kinds and files outside its store', () => {
    const f = fixture()
    writeSourceFile(f.data, f.source, 'exam', 'original')
    const copy = f.copies()[0]
    expect(() => readSourceCopy(f.data, copy, 'classes')).toThrow(/tipo/)
    expect(() => readSourceCopy(f.data, f.source, 'exam')).toThrow(/almacén/)
    const raw = JSON.parse(readFileSync(copy, 'utf8')); raw.content = Buffer.from('tampered').toString('base64')
    writeFileSync(copy, JSON.stringify(raw))
    expect(() => readSourceCopy(f.data, copy, 'exam')).toThrow(/dañada/)
    expect(() => writeSourceFile(f.data, f.source, 'exam', 'new')).toThrow(/dañada/)
    expect(readFileSync(f.source, 'utf8')).toBe('original')
  })

  it('a failed backup or oversized proposal never replaces the original', () => {
    const f = fixture()
    writeFileSync(f.source, 'original')
    mkdirSync(f.data); writeFileSync(sourceCopiesRoot(f.data), 'not a directory')
    expect(() => writeSourceFile(f.data, f.source, 'exam', 'new')).toThrow()
    expect(readFileSync(f.source, 'utf8')).toBe('original')
    rmSync(sourceCopiesRoot(f.data))
    expect(() => writeSourceFile(f.data, f.source, 'exam', 'x'.repeat(MAX_SOURCE_BYTES + 1))).toThrow(/4 MiB/)
    expect(readFileSync(f.source, 'utf8')).toBe('original')
  })

  it('refuses original and copy symlinks without touching their targets', () => {
    const f = fixture(), other = join(f.root, 'outside')
    writeFileSync(other, 'untouched'); symlinkSync(other, f.source)
    expect(() => writeSourceFile(f.data, f.source, 'exam', 'new')).toThrow(/regular/)
    expect(readFileSync(other, 'utf8')).toBe('untouched')
    rmSync(f.source); writeSourceFile(f.data, f.source, 'exam', 'original')
    const link = join(f.slot, 'link.json'); symlinkSync(other, link)
    expect(() => readSourceCopy(f.data, link, 'exam')).toThrow()
  })
})


it('preserves a non-UTF8 corrupt original byte for byte during recovery', () => {
  const f = fixture(), original = Buffer.from([0xff, 0x00, 0xfe])
  writeFileSync(f.source, original)
  writeSourceFile(f.data, f.source, 'exam', 'recovered')
  expect(readFileSync(f.source, 'utf8')).toBe('recovered')
  const payloads = f.copies().map(path => JSON.parse(readFileSync(path, 'utf8')))
  expect(payloads.some(raw => Buffer.from(raw.content, 'base64').equals(original))).toBe(true)
})
