import { defineConfig } from 'vitest/config'

// Everything under test is pure logic plus the two main-process modules that
// do not import electron, so the node environment is enough: no jsdom, no
// React.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
