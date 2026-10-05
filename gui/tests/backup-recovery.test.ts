import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { restoreBackups, slotFor } from '../src/main/backup'
import { varDirOf } from '../src/main/history'
import { parseArtifact } from '../src/shared/artifact'
import { gradesOnly } from '../src/shared/backup'
import { validRun } from './fixtures/valid-run'

const hooks = vi.hoisted(() => ({
  beforeExists: undefined as ((path: string) => void) | undefined,
  beforePublish: undefined as ((path: string) => void) | undefined,
  beforeStage: undefined as ((path: string) => void) | undefined,
  published: [] as string[]
}))

// Pause only at filesystem boundaries. All reads, writes and publication use
// real files; a second OS process performs the competing write while restore
// is blocked waiting for it. No sleeps or simulated filesystem results.
vi.mock('node:fs', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return {
    ...fs,
    writeFileSync: (...args: Parameters<typeof fs.writeFileSync>) => {
      hooks.beforeStage?.(String(args[0]))
      return fs.writeFileSync(...args)
    },
    existsSync: (path: Parameters<typeof fs.existsSync>[0]) => {
      hooks.beforeExists?.(String(path))
      return fs.existsSync(path)
    },
    renameSync: (...args: Parameters<typeof fs.renameSync>) => {
      hooks.beforePublish?.(String(args[1]))
      fs.renameSync(...args)
      hooks.published.push(basename(String(args[1])))
    },
    linkSync: (...args: Parameters<typeof fs.linkSync>) => {
      hooks.beforePublish?.(String(args[1]))
      fs.linkSync(...args)
      hooks.published.push(basename(String(args[1])))
    }
  }
})

const dirs: string[] = []
afterEach(() => {
  hooks.beforeExists = undefined
  hooks.beforePublish = undefined
  hooks.beforeStage = undefined
  hooks.published.length = 0
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function fixture(chain = false) {
  const root = mkdtempSync(join(tmpdir(), 'heimdall-recovery-'))
  dirs.push(root)
  const dataDir = join(root, 'data'), examPath = join(root, 'exam', 'examen.yaml')
  const varDir = varDirOf(examPath), slot = slotFor(dataDir, examPath)
  mkdirSync(varDir, { recursive: true })
  mkdirSync(slot, { recursive: true })
  const original = validRun()
  original.run_id = chain ? 'HEAD' : 'R1'
  if (chain) original.retry_of = {
    run_id: 'ROOT', artifact: '/old/var/run-ROOT.json',
    run_at: original.started_at, students: 1, checks: 1
  }
  // Head sorts before ancestor: recovery must impose dependency order.
  const copy = ` ${JSON.stringify(gradesOnly(original))}\n`
  const name = `run-${original.run_id}.json`
  writeFileSync(join(slot, name), copy)
  if (chain) {
    const ancestor = validRun(); ancestor.run_id = 'ROOT'
    writeFileSync(join(slot, 'run-ROOT.json'), JSON.stringify(gradesOnly(ancestor)))
  }
  return { dataDir, examPath, varDir, slot, copy, original, name }
}

function externalWriter(path: string, text: string, replace = false) {
  const script = `
    const fs = require('node:fs');
    const [path, replace] = process.argv.slice(1);
    const text = fs.readFileSync(0, 'utf8');
    if (replace === 'true') {
      const tmp = path + '.writer';
      fs.writeFileSync(tmp, text, { flag: 'wx' });
      fs.renameSync(tmp, path);
    } else fs.writeFileSync(path, text, { flag: 'wx' });
    process.stdout.write(String(process.pid));
  `
  const result = spawnSync(process.execPath, ['-e', script, path, String(replace)], {
    input: text, encoding: 'utf8', timeout: 5000
  })
  expect(result.error).toBeUndefined()
  expect(result.status, result.stderr).toBe(0)
  expect(Number(result.stdout)).not.toBe(process.pid)
}

describe('recovery with a concurrent external writer', () => {
  it.each([false, true])('restores the validated chain when a copy changes (writer=%s)', writer => {
    const f = fixture(true)
    let boundary = 0
    const replacement = parseArtifact(f.copy)
    replacement.retry_of!.run_id = 'MISSING'
    replacement.retry_of!.artifact = '/old/var/run-MISSING.json'
    const replacedText = JSON.stringify(replacement)
    // This is valid individually: the defect concerns chain validation.
    expect(parseArtifact(replacedText).retry_of!.run_id).toBe('MISSING')
    hooks.beforeExists = path => {
      if (path !== join(f.varDir, f.name)) return
      hooks.beforeExists = undefined
      boundary++
      if (writer) externalWriter(join(f.slot, f.name), replacedText, true)
    }
    expect(restoreBackups(f.dataDir, f.examPath)).toEqual({ restored: 2, kept: 0 })
    expect(boundary).toBe(1)
    expect(readFileSync(join(f.varDir, f.name), 'utf8')).toBe(f.copy)
    const head = parseArtifact(readFileSync(join(f.varDir, f.name), 'utf8'))
    const root = parseArtifact(readFileSync(join(f.varDir, 'run-ROOT.json'), 'utf8'))
    expect(head.retry_of!.run_id).toBe(root.run_id)
    expect(head.plan_hash).toBe(root.plan_hash)
    expect(readFileSync(join(f.slot, f.name), 'utf8')).toBe(writer ? replacedText : f.copy)
  })

  it.each([false, true])('preserves an original created just before publication (writer=%s)', writer => {
    const f = fixture()
    const originalText = `${JSON.stringify(f.original, null, 2)}\n`
    let boundary = 0
    hooks.beforePublish = path => {
      if (path !== join(f.varDir, f.name)) return
      hooks.beforePublish = undefined
      boundary++
      if (writer) externalWriter(path, originalText)
    }
    expect(restoreBackups(f.dataDir, f.examPath)).toEqual(writer
      ? { restored: 0, kept: 1 } : { restored: 1, kept: 0 })
    expect(boundary).toBe(1)
    expect(readFileSync(join(f.varDir, f.name), 'utf8')).toBe(writer ? originalText : f.copy)
    expect(parseArtifact(readFileSync(join(f.varDir, f.name), 'utf8'))
      .students[0].checks[0].execution).toEqual(writer ? f.original.students[0].checks[0].execution : null)
    expect(readdirSync(f.varDir)).toEqual([f.name])
  })

  it('publishes ancestors before heads even when directory order is reversed', () => {
    const f = fixture(true)
    hooks.beforePublish = path => {
      if (path === join(f.varDir, f.name)) expect(existsSync(join(f.varDir, 'run-ROOT.json'))).toBe(true)
    }
    expect(restoreBackups(f.dataDir, f.examPath)).toEqual({ restored: 2, kept: 0 })
    expect(hooks.published).toEqual(['run-ROOT.json', f.name])
    expect(readdirSync(f.varDir).sort()).toEqual([f.name, 'run-ROOT.json'].sort())
  })

  it('restores independent valid grades and skips a broken chain', () => {
    const f = fixture(true)
    const independent = validRun(); independent.run_id = 'A'
    writeFileSync(join(f.slot, 'run-A.json'), JSON.stringify(gradesOnly(independent)))
    rmSync(join(f.slot, 'run-ROOT.json'))
    const report = restoreBackups(f.dataDir, f.examPath)
    expect(report).toMatchObject({ restored: 1, kept: 0 })
    expect(report.problems?.[0]).toMatch(/run-HEAD\.json.*antecedente/)
    expect(hooks.published).toEqual(['run-A.json'])
    expect(readdirSync(f.varDir)).toEqual(['run-A.json'])
    expect(readFileSync(join(f.slot, f.name), 'utf8')).toBe(f.copy)
  })

  it('reports a staging write failure and removes all private temporary files', () => {
    const f = fixture()
    hooks.beforeStage = path => {
      if (!path.includes('.heimdall-restore-')) return
      hooks.beforeStage = undefined
      // Real filesystem failure: the staged file's path is a directory.
      mkdirSync(path)
    }
    expect(() => restoreBackups(f.dataDir, f.examPath)).toThrow(/EEXIST/)
    expect(hooks.published).toEqual([])
    expect(readdirSync(f.varDir)).toEqual([])
    expect(readFileSync(join(f.slot, f.name), 'utf8')).toBe(f.copy)
  })

  it('reports publication failure, cleans staging and leaves only the complete ancestor', () => {
    const f = fixture(true)
    hooks.beforePublish = path => {
      if (path !== join(f.varDir, f.name)) return
      hooks.beforePublish = undefined
      const staged = readdirSync(f.varDir).find(name => name.startsWith('.heimdall-restore-'))!
      // Real ENOENT from publication, after the ancestor was published.
      rmSync(join(f.varDir, staged, f.name))
    }
    expect(() => restoreBackups(f.dataDir, f.examPath)).toThrow(/ENOENT/)
    expect(hooks.published).toEqual(['run-ROOT.json'])
    expect(readdirSync(f.varDir)).toEqual(['run-ROOT.json'])
    expect(parseArtifact(readFileSync(join(f.varDir, 'run-ROOT.json'), 'utf8')).run_id).toBe('ROOT')
    expect(readFileSync(join(f.slot, f.name), 'utf8')).toBe(f.copy)
  })

  it('keeps an existing dangling symlink without replacing it', () => {
    const f = fixture()
    const path = join(f.varDir, f.name)
    const result = spawnSync(process.execPath, ['-e',
      "require('node:fs').symlinkSync('missing-original.json', process.argv[1])", path],
    { encoding: 'utf8', timeout: 5000 })
    expect(result.status, result.stderr).toBe(0)
    // existsSync is false for a dangling symlink; publication still must
    // preserve the directory entry and count it as kept.
    expect(existsSync(path)).toBe(false)
    expect(restoreBackups(f.dataDir, f.examPath)).toEqual({ restored: 0, kept: 1 })
    expect(existsSync(path)).toBe(false)
    expect(readdirSync(f.varDir)).toEqual([f.name])
  })
})
