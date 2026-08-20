import { readFileSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { defineConfig } from 'tsup';

const pkgRaw: unknown = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
);

if (
  typeof pkgRaw !== 'object' ||
  pkgRaw === null ||
  !('version' in pkgRaw) ||
  typeof pkgRaw.version !== 'string'
) {
  throw new Error('package.json is missing a string "version" field');
}
const pkg = pkgRaw;

export default defineConfig({
  entry: ['src/index.ts', 'src/commands/poster.ts', 'src/poster/*.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  async onSuccess() {
    // Copy harness sources verbatim — they get bundled on demand against the
    // user's node_modules at poster time, so they must NOT be pre-compiled.
    const srcDir = new URL('./src/harness/', import.meta.url).pathname;
    const dstDir = new URL('./dist/harness/', import.meta.url).pathname;

    await mkdir(dstDir, { recursive: true });
    for (const f of ['index.html', 'index.tsx', 'frameReady.ts']) {
      await copyFile(`${srcDir}${f}`, `${dstDir}${f}`);
    }
  },
});
