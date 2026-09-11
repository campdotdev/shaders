// Vitest config for the map app. Tests run in the `node` environment because
// the timeline, layout, and data tests never touch the GPU or the DOM. The
// `@` alias is redeclared here, matching vite.config.ts, because Vitest
// doesn't read tsconfig `paths`.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.test.ts'],
  },
});
