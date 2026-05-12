import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Vite 8 OXC cannot resolve ${configDir} in our shared tsconfig/library.json.
  // Provide the essential compiler options inline so OXC skips file-based discovery.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oxc: { tsconfig: { compilerOptions: { verbatimModuleSyntax: true } } } as any,
  test: {
    name: '@lovo/matter-react',
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
