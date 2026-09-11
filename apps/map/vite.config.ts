// Vite config for the codebase map. The map only ever runs locally, so the
// config injects the absolute repo root at build time: the panel's file links
// need it to build vscode://file/ URLs, and the data files stay repo-relative.
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');

export default defineConfig({
  plugins: [react()],
  server: { port: 3010, strictPort: true },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __REPO_ROOT__: JSON.stringify(repoRoot),
  },
});
