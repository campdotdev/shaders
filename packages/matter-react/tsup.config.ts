import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/poster.ts', 'src/gamut.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'three', '@mattermix/shaders'],
  banner: { js: "'use client';" },
});
