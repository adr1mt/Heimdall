import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { parseArtifact } from '../src/shared/artifact'
import { readArtifact, readArtifactAsync } from '../src/main/artifact'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const corpus = JSON.parse(readFileSync(fileURLToPath(new URL('../../testdata/artifacts/corpus.json', import.meta.url)), 'utf8')) as { name: string; accept: boolean; artifact: unknown }[]
it('has a nonempty shared corpus', () => expect(corpus.length).toBeGreaterThan(0))
it.each(corpus)('$name: shared acceptance through parser and both file readers', async ({ artifact, accept }) => {
  const text = JSON.stringify(artifact)
  const dir = mkdtempSync(join(tmpdir(), 'heimdall-corpus-'))
  const path = join(dir, 'run.json')
  try {
    writeFileSync(path, text)
    if (accept) {
      expect(parseArtifact(text)).toBeDefined()
      expect(readArtifact(path)).toEqual(parseArtifact(text))
      await expect(readArtifactAsync(path)).resolves.toEqual(parseArtifact(text))
    } else {
      expect(() => parseArtifact(text)).toThrow()
      expect(() => readArtifact(path)).toThrow()
      await expect(readArtifactAsync(path)).rejects.toThrow()
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
