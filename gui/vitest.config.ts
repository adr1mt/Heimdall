import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Everything under test is pure logic plus the two main-process modules that
// do not import electron, so the node environment is enough: no jsdom, no
// React.
//
// The aliases are the ones tsconfig.web.json declares: a module under test
// that imports a sibling by `@/…` has to resolve here exactly as it does in
// the application, or the test would be running different code.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
