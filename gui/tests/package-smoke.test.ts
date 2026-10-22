import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

it('the packaged-page probe waits for a body without mistaking startup for success', () => {
  const script = readFileSync(new URL('../scripts/smoke-package.mjs', import.meta.url), 'utf8')
  const expression = script.match(/expression:\s*'([^']+)'/)?.[1]
  expect(expression).toBeDefined()
  const initial = runInNewContext(expression!, { document: { title: '', body: null }, window: {} })
  expect(initial).toMatchObject({ api: 'undefined', text: '' })
  const ready = runInNewContext(expression!, { document: { title: 'Heimdall', body: { innerText: 'Heimdall' } }, window: { heimdall: {} } })
  expect(ready).toMatchObject({ title: 'Heimdall', api: 'object', text: 'Heimdall' })
})
