import { afterEach, expect, it, vi } from 'vitest'
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_ARTIFACT, readArtifact, readArtifactAsync, readArtifactSnapshot } from '../src/main/artifact'
import { validRun } from './fixtures/valid-run'

const growth = vi.hoisted(() => ({ path: '' }))

// Grow a real file just after its size has been observed. Both readers must
// enforce actual bytes instead of trusting the stale metadata.
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return { ...fs, fstatSync: (...args: Parameters<typeof fs.fstatSync>) => {
    const result = fs.fstatSync(...args)
    if (growth.path) { fs.appendFileSync(growth.path, ' '); growth.path = '' }
    return result
  } }
})
vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs/promises')>()
  return { ...fs, open: async (...args: Parameters<typeof fs.open>) => {
    const file = await fs.open(...args)
    const stat = file.stat.bind(file)
    file.stat = (async () => {
      const result = await stat()
      if (growth.path) { appendFileSync(growth.path, ' '); growth.path = '' }
      return result
    }) as typeof file.stat
    return file
  } }
})

const dirs: string[] = []
afterEach(() => { growth.path = ''; for (const dir of dirs.splice(0)) rmSync(dir, {recursive:true, force:true}) })
function fixture(extra = 0): string {
  const dir = mkdtempSync(join(tmpdir(), 'heimdall-reader-')); dirs.push(dir)
  const path = join(dir, 'run-R1.json')
  const text = JSON.stringify(validRun())
  writeFileSync(path, text)
  if (extra !== -MAX_ARTIFACT) appendFileSync(path, Buffer.alloc(MAX_ARTIFACT - Buffer.byteLength(text) + extra, 32))
  return path
}

it('preserves validated text for restoration and reads the same result asynchronously', async () => {
  const path = fixture(-MAX_ARTIFACT)
  const snapshot = readArtifactSnapshot(path)
  expect(JSON.parse(snapshot.text)).toEqual(validRun())
  expect(snapshot.run).toEqual(await readArtifactAsync(path))
})
it.each([-1, 0])('accepts a valid artifact at 64 MiB %+i bytes', async (extra) => {
  const path = fixture(extra)
  expect(readArtifact(path).run_id).toBe('R1')
  expect((await readArtifactAsync(path)).run_id).toBe('R1')
}, 15000)
it('rejects a byte over the limit before parsing JSON', async () => {
  const path = fixture(1)
  expect(() => readArtifact(path)).toThrow(/64 MB/)
  await expect(readArtifactAsync(path)).rejects.toThrow(/64 MB/)
}, 15000)
it('rejects growth after stat in synchronous and asynchronous reads', async () => {
  const sync = fixture(); growth.path = sync
  expect(() => readArtifact(sync)).toThrow(/64 MB/)
  const asyncPath = fixture(); growth.path = asyncPath
  await expect(readArtifactAsync(asyncPath)).rejects.toThrow(/64 MB/)
}, 15000)
it('reports invalid or missing files through both readers', async () => {
  const path = fixture(-MAX_ARTIFACT)
  writeFileSync(path, '{')
  expect(() => readArtifact(path)).toThrow(/JSON válido/)
  await expect(readArtifactAsync(path)).rejects.toThrow(/JSON válido/)
  rmSync(path)
  expect(() => readArtifact(path)).toThrow()
  await expect(readArtifactAsync(path)).rejects.toThrow()
})
