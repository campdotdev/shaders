import { build } from 'esbuild'
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface BundlePosterOpts {
  from: string
  exportName: string
  projectRoot: string
}

export interface BundlePosterResult {
  js: string
  html: string
}

// HARNESS_DIR resolution is intentionally async and memoized.
//
// The old synchronous approach used a regex replace on `import.meta.url` to derive the harness
// path. That worked when the file was at `src/poster/bundle.ts` (dev) or `dist/poster/bundle.js`
// (a per-directory dist layout), but tsup's code-splitting emits the actual implementation into
// `dist/chunk-XXXX.js` at the dist root — not under `dist/poster/` — so the `/poster$/` regex
// never matched and HARNESS_DIR collapsed to `<pkg>/dist`, causing esbuild to look for
// `dist/index.tsx` instead of `dist/harness/index.tsx`.
//
// The fix: walk up the directory tree from `import.meta.url` until we find a `package.json`
// with `name === '@lovo/matter-cli'`, then try `dist/harness` then `src/harness` in order.
// This is robust to any output chunk location tsup chooses.

let harnessDirPromise: Promise<string> | undefined

async function locateHarnessDir(): Promise<string> {
  if (harnessDirPromise) return harnessDirPromise
  harnessDirPromise = (async () => {
    let dir = dirname(fileURLToPath(import.meta.url))

    for (;;) {
      try {
        const pkgRaw = await readFile(join(dir, 'package.json'), 'utf-8')
        const parsed: unknown = JSON.parse(pkgRaw)
        const pkg = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as {
          name?: string
        }

        if (pkg.name === '@lovo/matter-cli') {
          for (const candidate of ['dist/harness', 'src/harness']) {
            const harnessPath = join(dir, candidate)

            try {
              await access(join(harnessPath, 'index.html'))

              return harnessPath
            } catch {
              // try next candidate
            }
          }
          throw new Error(
            `Found @lovo/matter-cli at ${dir} but neither dist/harness nor src/harness contains index.html`,
          )
        }
      } catch (err) {
        // Re-throw if we found the package but harness is missing
        if (err instanceof Error && err.message.startsWith('Found @lovo/matter-cli')) {
          throw err
        }
        // Otherwise, package.json missing or wrong name; walk up
      }
      const parent = dirname(dir)

      if (parent === dir) {
        throw new Error(
          'Could not locate @lovo/matter-cli package root from ' + fileURLToPath(import.meta.url),
        )
      }
      dir = parent
    }
  })()

  return harnessDirPromise
}

export async function bundlePoster(opts: BundlePosterOpts): Promise<BundlePosterResult> {
  const harnessDir = await locateHarnessDir()
  const harnessEntry = join(harnessDir, 'index.tsx')
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

  const out = result.outputFiles.find((f) => f.path.endsWith('index.js')) ?? result.outputFiles[0]

  if (!out) throw new Error('bundlePoster: esbuild produced no output')
  const html = await readFile(join(harnessDir, 'index.html'), 'utf-8')

  return { js: out.text, html }
}
