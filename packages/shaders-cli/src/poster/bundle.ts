// Poster pipeline stage 1 (of bundle -> server -> playwright -> harness):
// esbuild the harness entry together with the user's component file into a
// single in-memory JS bundle — nothing is written to disk. The user's file
// is injected by path through an esbuild `define` placeholder, and all
// imports resolve against the USER's project (absWorkingDir/nodePaths), so
// the poster renders with the exact package versions their app uses.
import { build } from 'esbuild';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface BundlePosterOpts {
  from: string;
  exportName: string;
  projectRoot: string;
}

export interface BundlePosterResult {
  js: string;
  html: string;
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
// with `name === '@camp-dev/shaders-cli'`, then try `dist/harness` then `src/harness` in order.
// This is robust to any output chunk location tsup chooses.

const CLI_PACKAGE_NAME = '@camp-dev/shaders-cli';

// Built output first, so an installed CLI uses its bundled harness. The source fallback
// covers dev and test runs straight from `src/`.
const HARNESS_CANDIDATES = ['dist/harness', 'src/harness'];

let harnessDirPromise: Promise<string> | undefined;

function locateHarnessDir(): Promise<string> {
  harnessDirPromise ??= resolveHarnessDir(fileURLToPath(import.meta.url));

  return harnessDirPromise;
}

// ---------------------------------------------
// Harness search
// ---------------------------------------------

// `fromFile` is the module doing the looking. Only the first ancestor whose package.json names
// the CLI counts: if it has no harness, the search throws there rather than walking on to an
// outer copy of the package.
export async function resolveHarnessDir(fromFile: string): Promise<string> {
  for (const dir of ancestorDirs(dirname(fromFile))) {
    if ((await readPackageName(dir)) !== CLI_PACKAGE_NAME) continue;

    const harnessDir = await findHarnessIn(dir);

    if (harnessDir !== undefined) return harnessDir;
    throw new Error(
      `Found ${CLI_PACKAGE_NAME} at ${dir} but neither dist/harness nor src/harness contains index.html`,
    );
  }
  throw new Error(`Could not locate ${CLI_PACKAGE_NAME} package root from ${fromFile}`);
}

// `startDir`, then each parent in turn, ending at the filesystem root, the one directory that
// `dirname` returns unchanged.
export function* ancestorDirs(startDir: string): Generator<string> {
  let dir = startDir;

  for (;;) {
    yield dir;
    const parent = dirname(dir);

    if (parent === dir) return;
    dir = parent;
  }
}

// The `name` field of `dir/package.json`, or undefined when the file is missing or isn't JSON.
// Either case means "not our package, keep walking".
async function readPackageName(dir: string): Promise<string | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'));
    const packageJson = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as {
      name?: string;
    };

    return packageJson.name;
  } catch {
    return undefined;
  }
}

// The first harness candidate under `packageRoot` that holds an `index.html`.
async function findHarnessIn(packageRoot: string): Promise<string | undefined> {
  for (const candidate of HARNESS_CANDIDATES) {
    const harnessPath = join(packageRoot, candidate);

    if (await fileExists(join(harnessPath, 'index.html'))) return harnessPath;
  }

  return undefined;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------
// Bundle
// ---------------------------------------------

export async function bundlePoster(opts: BundlePosterOpts): Promise<BundlePosterResult> {
  const harnessDir = await locateHarnessDir();
  const harnessEntry = join(harnessDir, 'index.tsx');
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
      __SHADERS_USER_MODULE_PATH: JSON.stringify(opts.from),
      __SHADERS_EXPORT_NAME: JSON.stringify(opts.exportName),
    },
    write: false,
    sourcemap: 'inline',
    logLevel: 'silent',
  });

  const indexOutput =
    result.outputFiles.find((outputFile) => outputFile.path.endsWith('index.js')) ??
    result.outputFiles[0];

  if (!indexOutput) throw new Error('bundlePoster: esbuild produced no output');
  const html = await readFile(join(harnessDir, 'index.html'), 'utf-8');

  return { js: indexOutput.text, html };
}
