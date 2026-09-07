import { defineConfig } from 'tsup';

// Four entries. The root, gamut, and poster sources carry a 'use client'
// directive on line 1, which esbuild keeps on the emitted entry chunk, so no
// banner is needed and none is set: a banner would also stamp ./color, whose
// function exports server code calls, and a 'use client' module turns those
// into client references that throw on the server.
export default defineConfig({
  entry: ['src/index.ts', 'src/color.ts', 'src/gamut.ts', 'src/poster.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', /^three/],
});
