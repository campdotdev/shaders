import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@lovo/matter-cli',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
