import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@lovo/matter-react',
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
  },
})
