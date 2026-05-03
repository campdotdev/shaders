import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@lovo/matter',
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
