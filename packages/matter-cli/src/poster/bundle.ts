import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

export interface BundlePosterOpts {
  from: string
  exportName: string
  projectRoot: string
}

export interface BundlePosterResult {
  js: string
  html: string
}

// In dev: this file is at <pkg>/src/poster/bundle.ts → HARNESS_DIR = <pkg>/src/harness
// In dist: this file is at <pkg>/dist/poster/bundle.js → HARNESS_DIR = <pkg>/dist/harness
const HARNESS_DIR = dirname(fileURLToPath(import.meta.url)).replace(/\/poster$/, '/harness')

export async function bundlePoster(opts: BundlePosterOpts): Promise<BundlePosterResult> {
  const harnessEntry = join(HARNESS_DIR, 'index.tsx')
  const result = await build({
    entryPoints: [harnessEntry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    absWorkingDir: opts.projectRoot,
    nodePaths: [join(opts.projectRoot, 'node_modules')],
    define: {
      __MATTER_USER_MODULE_PATH: JSON.stringify(opts.from),
      __MATTER_EXPORT_NAME: JSON.stringify(opts.exportName),
    },
    write: false,
    sourcemap: 'inline',
    logLevel: 'silent',
  })

  const out =
    result.outputFiles?.find((f) => f.path.endsWith('index.js')) ?? result.outputFiles?.[0]
  if (!out) throw new Error('bundlePoster: esbuild produced no output')
  const html = await readFile(join(HARNESS_DIR, 'index.html'), 'utf-8')
  return { js: out.text, html }
}
