import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vitest doesn't read tsconfig `paths`, so the `@/` alias every cross-folder
  // import uses has to be declared here too, or the unit tests resolve nothing
  // outside their own directory.
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
