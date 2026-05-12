import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vite 8 OXC cannot resolve ${configDir} in our shared tsconfig/library.json.
  // Provide the essential compiler options inline so OXC skips file-based discovery.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oxc: { tsconfig: { compilerOptions: { verbatimModuleSyntax: true } } } as any,
  test: {
    name: '@lovo/matter',
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
