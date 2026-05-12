import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'

// @ts-expect-error -- @vitejs/plugin-react@6 types are not fully compatible with vite-plus-core's
// Plugin type in 0.1.20; suppress until vite-plus ships updated Plugin compat types.
// The second @ts-expect-error below covers the oxc key which is not in UserConfig yet.
export default defineConfig({
  // @ts-expect-error -- see note above
  plugins: [react()],
  // Vite 8 OXC cannot resolve ${configDir} in our shared tsconfig/library.json.
  // Provide the essential compiler options inline so OXC skips file-based discovery.
  // @ts-expect-error -- oxc is not in UserConfig types yet; this is the documented workaround
  oxc: { tsconfig: { compilerOptions: { verbatimModuleSyntax: true } } },
  test: {
    name: '@lovo/matter-react',
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
