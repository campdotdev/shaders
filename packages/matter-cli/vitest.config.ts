import { defineConfig } from 'vitest/config'

export default defineConfig({
  // @ts-expect-error -- oxc is not in UserConfig types yet; this is the documented workaround
  oxc: { tsconfig: { compilerOptions: { verbatimModuleSyntax: true } } },
  test: {
    name: '@lovo/matter-cli',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
