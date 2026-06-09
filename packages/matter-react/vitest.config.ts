import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
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
});
