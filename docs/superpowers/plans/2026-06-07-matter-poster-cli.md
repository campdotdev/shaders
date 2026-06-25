# Matter poster CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `matter poster --from <file> --out <path>` command to `@lovo/matter-cli` that headlessly renders the user's Matter component tree to a PNG for use as a `<ShaderScene fallback>`.

**Architecture:** The CLI esbuild-bundles the user's `.tsx` (resolving all imports against the user's `node_modules` to avoid the two-copies-of-three trap), serves the bundle from an ephemeral localhost HTTP server, drives a Playwright Chromium to navigate + wait for the first non-blank frame + screenshot the canvas, then writes the PNG and prints a wiring snippet.

**Tech Stack:** Node 22, TypeScript 5 (strict, ESM, verbatimModuleSyntax), commander (CLI), esbuild (bundling — new runtime dep), node:http (ephemeral server), Playwright (optional peer dep on the user's side), vitest 4 (tests).

**Spec:** [`docs/superpowers/specs/2026-06-07-matter-poster-cli-design.md`](../specs/2026-06-07-matter-poster-cli-design.md)

---

## File Structure

**New files in `packages/matter-cli/`:**

| Path                                                    | Responsibility                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/commands/poster.ts`                                | `runPoster()` orchestration — flags → bundle → serve → screenshot → write   |
| `src/commands/poster.test.ts`                           | Unit tests for flag validation, snippet formatting, error mapping           |
| `src/poster/bundle.ts`                                  | `bundlePoster()` — esbuild wrapper, resolves user's project root            |
| `src/poster/bundle.test.ts`                             | Tests against fixture .tsx files                                            |
| `src/poster/server.ts`                                  | `createPosterServer()` — ephemeral node:http server                         |
| `src/poster/server.test.ts`                             | Tests for routes, port selection, lifecycle                                 |
| `src/poster/playwright.ts`                              | `launchAndScreenshot()` — wraps Playwright; resolves peer dep at runtime    |
| `src/poster/playwright.test.ts`                         | Tests for missing-peer behaviour (mocked import); E2E gated separately      |
| `src/poster/projectRoot.ts`                             | `findProjectRoot(fromPath)` — walks up to nearest `package.json`            |
| `src/poster/projectRoot.test.ts`                        | Tests for the walk                                                          |
| `src/harness/index.html`                                | Minimal HTML shell, references `harness.js`                                 |
| `src/harness/index.tsx`                                 | Harness shell: imports user component, renders it, signals `__matterReady` |
| `src/harness/frameReady.ts`                             | Pixel-sample helper; sets `window.__matterReady`                            |
| `src/test-fixtures/posters/single-linear-gradient.tsx`  | E2E fixture                                                                 |
| `src/test-fixtures/posters/gradient-plus-grain.tsx`     | E2E fixture (composition)                                                   |
| `src/test-fixtures/posters/aurora-with-time.tsx`        | E2E fixture (slow-developing)                                               |
| `src/test-fixtures/posters/named-export.tsx`            | E2E fixture exercising `--export <name>`                                    |
| `src/poster/e2e.test.ts`                                | E2E layer, gated on `MATTER_E2E=1`                                          |

**Modified files:**

| Path                                       | Change                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `packages/matter-cli/package.json`         | Add `esbuild` to `dependencies`; add optional `playwright` peer dep                   |
| `packages/matter-cli/src/index.ts`         | Register `poster` command                                                              |
| `packages/matter-cli/tsup.config.ts`       | Copy `src/harness/index.html` and `src/harness/index.tsx` into `dist/harness/` source |
| `packages/matter-cli/README.md`            | Document `poster` command                                                              |

**Why the harness ships as source:** the CLI bundles it on demand against the user's `node_modules` (so `three`, `react`, `@lovo/matter*` resolve to the user's installed copies). Pre-bundling would defeat that.

---

## Phase 1 — Command skeleton (TDD-able)

End state: `pnpm matter-cli poster --help` shows the new command with correct flags. No rendering yet.

### Task 1.1: Register `poster` command in `src/index.ts`

**Files:**
- Modify: `packages/matter-cli/src/index.ts`

- [ ] **Step 1: Add the command registration**

Edit `packages/matter-cli/src/index.ts`, adding this block before the final `await program.parseAsync(...)` line:

```ts
program
  .command('poster')
  .description('render a Matter component tree to a static PNG for use as <ShaderScene fallback>')
  .requiredOption('--from <file>', 'path to a .tsx/.ts file exporting the component to render')
  .requiredOption('--out <path>', 'where to write the PNG')
  .option('--export <name>', 'named export to render', 'default')
  .option('--time <seconds>', 'wait this long after first non-blank frame', '0')
  .option('--width <px>', 'render width', '1280')
  .option('--height <px>', 'render height', '720')
  .action(
    async (opts: {
      from: string
      out: string
      export: string
      time: string
      width: string
      height: string
    }) => {
      try {
        const { runPoster } = await import('./commands/poster.js')
        await runPoster({
          from: opts.from,
          out: opts.out,
          exportName: opts.export,
          timeSeconds: Number.parseFloat(opts.time),
          width: Number.parseInt(opts.width, 10),
          height: Number.parseInt(opts.height, 10),
        })
      } catch (err) {
        fail(err)
      }
    },
  )
```

- [ ] **Step 2: Create a stub `runPoster` so the build still passes**

Create `packages/matter-cli/src/commands/poster.ts`:

```ts
export interface PosterOptions {
  from: string
  out: string
  exportName: string
  timeSeconds: number
  width: number
  height: number
}

export interface PosterIO {
  cwd: string
  log: (line: string) => void
}

export async function runPoster(
  _opts: PosterOptions,
  _io: PosterIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  throw new Error('poster command not yet implemented')
}
```

- [ ] **Step 3: Build and confirm `--help` lists the command**

Run:
```bash
pnpm --filter @lovo/matter-cli build
node packages/matter-cli/dist/index.js poster --help
```
Expected output (excerpt):
```
Usage: matter-cli poster [options]

render a Matter component tree to a static PNG ...

Options:
  --from <file>       path to a .tsx/.ts file ...
  --out <path>        where to write the PNG
  --export <name>     named export to render (default: "default")
  --time <seconds>    wait this long after first non-blank frame (default: "0")
  --width <px>        render width (default: "1280")
  --height <px>       render height (default: "720")
```

- [ ] **Step 4: Commit**

```bash
git add packages/matter-cli/src/index.ts packages/matter-cli/src/commands/poster.ts
git commit -m "feat(matter-cli): register \`poster\` command skeleton"
```

### Task 1.2: Validate `--width`/`--height` early with TDD

**Files:**
- Modify: `packages/matter-cli/src/commands/poster.ts`
- Create: `packages/matter-cli/src/commands/poster.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/matter-cli/src/commands/poster.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { runPoster } from './poster.js'

const base = {
  from: '/tmp/nope.tsx',
  out: '/tmp/poster.png',
  exportName: 'default',
  timeSeconds: 0,
  width: 1280,
  height: 720,
}

describe('runPoster — flag validation', () => {
  it('rejects width <= 0', async () => {
    await expect(
      runPoster({ ...base, width: 0 }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--width.*must be a positive integer ≤ 4096/)
  })

  it('rejects width > 4096', async () => {
    await expect(
      runPoster({ ...base, width: 5000 }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--width.*must be a positive integer ≤ 4096/)
  })

  it('rejects height <= 0', async () => {
    await expect(
      runPoster({ ...base, height: -1 }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--height.*must be a positive integer ≤ 4096/)
  })

  it('rejects timeSeconds < 0', async () => {
    await expect(
      runPoster({ ...base, timeSeconds: -1 }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--time.*must be ≥ 0/)
  })
})
```

- [ ] **Step 2: Run the tests; expect them to fail (validation not implemented)**

```bash
pnpm --filter @lovo/matter-cli test src/commands/poster.test.ts
```
Expected: 4 failing tests with "poster command not yet implemented" (validation happens after our stub throws — so the assertions about `--width` will fail).

- [ ] **Step 3: Implement validation at the top of `runPoster`**

Replace the body of `runPoster` in `packages/matter-cli/src/commands/poster.ts` with:

```ts
export async function runPoster(
  opts: PosterOptions,
  _io: PosterIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  if (!Number.isInteger(opts.width) || opts.width <= 0 || opts.width > 4096) {
    throw new Error(`--width must be a positive integer ≤ 4096 (got ${opts.width})`)
  }
  if (!Number.isInteger(opts.height) || opts.height <= 0 || opts.height > 4096) {
    throw new Error(`--height must be a positive integer ≤ 4096 (got ${opts.height})`)
  }
  if (!Number.isFinite(opts.timeSeconds) || opts.timeSeconds < 0) {
    throw new Error(`--time must be ≥ 0 (got ${opts.timeSeconds})`)
  }
  throw new Error('poster command not yet implemented')
}
```

- [ ] **Step 4: Run the tests; expect them to pass**

```bash
pnpm --filter @lovo/matter-cli test src/commands/poster.test.ts
```
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/matter-cli/src/commands/poster.ts packages/matter-cli/src/commands/poster.test.ts
git commit -m "feat(matter-cli): validate poster --width/--height/--time"
```

### GATE 1 — Validate

Run the help command, confirm everything looks right:
```bash
node packages/matter-cli/dist/index.js poster --help
node packages/matter-cli/dist/index.js poster --from foo --out bar --width 99999
```
Expected: help looks clean; the invalid-width invocation exits 1 with our error message.

---

## Phase 2 — User-component bundling (TDD-able)

End state: `bundlePoster()` takes a `--from` path and returns an in-memory ESM bundle string. Tested with fixtures.

### Task 2.1: Add `esbuild` to dependencies; write the harness sources; update tsup

**Files:**
- Modify: `packages/matter-cli/package.json`
- Modify: `packages/matter-cli/tsup.config.ts`
- Create: `packages/matter-cli/src/harness/index.html`
- Create: `packages/matter-cli/src/harness/index.tsx`
- Create: `packages/matter-cli/src/harness/frameReady.ts`

- [ ] **Step 1: Add esbuild to matter-cli's dependencies**

Edit `packages/matter-cli/package.json`. In `dependencies` (alongside `commander`), add:

```json
    "esbuild": "^0.24.0",
```

- [ ] **Step 2: Install**

```bash
pnpm install
```
Expected: lockfile updated, no errors.

- [ ] **Step 3: Create the HTML shell**

Create `packages/matter-cli/src/harness/index.html`:

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>matter poster</title>
<style>html,body,#root{margin:0;height:100%;background:#000}</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="/harness.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create the harness shell (TSX)**

Create `packages/matter-cli/src/harness/index.tsx`:

```tsx
import { createRoot } from 'react-dom/client'

import { installFrameReadyWatcher } from './frameReady.js'

// Replaced at build time by esbuild's `define`:
declare const __MATTER_USER_MODULE_PATH: string
declare const __MATTER_EXPORT_NAME: string

const userModule = (await import(/* @vite-ignore */ __MATTER_USER_MODULE_PATH)) as Record<
  string,
  unknown
>

const Component = userModule[__MATTER_EXPORT_NAME]

if (typeof Component !== 'function') {
  document.body.innerHTML = `<pre style="color:#fff;padding:1rem">matter poster: export "${__MATTER_EXPORT_NAME}" is not a React component (got ${typeof Component}). Available exports: ${Object.keys(
    userModule,
  ).join(', ')}</pre>`
  throw new Error(`export "${__MATTER_EXPORT_NAME}" is not a component`)
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('matter poster: #root missing from harness HTML')

const root = createRoot(rootEl)
root.render(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <(Component as any) />,
)

installFrameReadyWatcher()
```

- [ ] **Step 5: Create the frame-ready watcher stub**

Create `packages/matter-cli/src/harness/frameReady.ts`:

```ts
declare global {
  interface Window {
    __matterReady?: boolean
  }
}

export function installFrameReadyWatcher(): void {
  // Real implementation lands in Phase 4. For now, just satisfy imports.
  // We deliberately do NOT set __matterReady here; Phase 4 owns that contract.
}
```

- [ ] **Step 6: Update tsup to copy the harness sources into `dist/harness/`**

The bundler in Task 2.3 will look for the harness at `<pkg>/{src,dist}/harness/` depending on whether it's running from source (tests) or built (CLI). For the built CLI to work in later phases' manual gates, dist must contain the harness sources verbatim — NOT compiled.

Replace `packages/matter-cli/tsup.config.ts` with:

```ts
import { copyFile, mkdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'

import { defineConfig } from 'tsup'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

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
    const srcDir = new URL('./src/harness/', import.meta.url).pathname
    const dstDir = new URL('./dist/harness/', import.meta.url).pathname
    await mkdir(dstDir, { recursive: true })
    for (const f of ['index.html', 'index.tsx', 'frameReady.ts']) {
      await copyFile(`${srcDir}${f}`, `${dstDir}${f}`)
    }
  },
})
```

- [ ] **Step 7: Build and verify dist layout**

```bash
pnpm --filter @lovo/matter-cli build
ls packages/matter-cli/dist/harness/
```
Expected: `frameReady.ts`, `index.html`, `index.tsx` all present in `dist/harness/`.

- [ ] **Step 8: Commit**

```bash
git add packages/matter-cli/package.json packages/matter-cli/tsup.config.ts packages/matter-cli/src/harness/ pnpm-lock.yaml
git commit -m "feat(matter-cli): add esbuild dep, harness sources, tsup harness copy"
```

### Task 2.2: `findProjectRoot()` — walk up to nearest `package.json`

**Files:**
- Create: `packages/matter-cli/src/poster/projectRoot.ts`
- Create: `packages/matter-cli/src/poster/projectRoot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/matter-cli/src/poster/projectRoot.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { findProjectRoot } from './projectRoot.js'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-projectroot-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('findProjectRoot', () => {
  it('returns the directory containing package.json', async () => {
    await writeFile(join(dir, 'package.json'), '{}')
    await mkdir(join(dir, 'src', 'components'), { recursive: true })
    const file = join(dir, 'src', 'components', 'Hero.tsx')
    await writeFile(file, '')
    expect(await findProjectRoot(file)).toBe(dir)
  })

  it('walks up across multiple levels', async () => {
    await writeFile(join(dir, 'package.json'), '{}')
    await mkdir(join(dir, 'a', 'b', 'c'), { recursive: true })
    const file = join(dir, 'a', 'b', 'c', 'Hero.tsx')
    await writeFile(file, '')
    expect(await findProjectRoot(file)).toBe(dir)
  })

  it('throws if no package.json is found', async () => {
    await mkdir(join(dir, 'lonely'))
    const file = join(dir, 'lonely', 'Hero.tsx')
    await writeFile(file, '')
    await expect(findProjectRoot(file)).rejects.toThrow(/package\.json/i)
  })
})
```

- [ ] **Step 2: Run the test; expect failure (module missing)**

```bash
pnpm --filter @lovo/matter-cli test src/poster/projectRoot.test.ts
```
Expected: failure — "Cannot find module './projectRoot.js'".

- [ ] **Step 3: Implement**

Create `packages/matter-cli/src/poster/projectRoot.ts`:

```ts
import { access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export async function findProjectRoot(fromPath: string): Promise<string> {
  let dir = dirname(resolve(fromPath))
  // Guard against infinite loops on root (dirname('/') === '/').
  while (true) {
    try {
      await access(`${dir}/package.json`)
      return dir
    } catch {
      const parent = dirname(dir)
      if (parent === dir) {
        throw new Error(
          `Could not find a package.json walking up from ${fromPath}. Poster needs a project root to resolve dependencies against.`,
        )
      }
      dir = parent
    }
  }
}
```

- [ ] **Step 4: Run tests; expect pass**

```bash
pnpm --filter @lovo/matter-cli test src/poster/projectRoot.test.ts
```
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/matter-cli/src/poster/projectRoot.ts packages/matter-cli/src/poster/projectRoot.test.ts
git commit -m "feat(matter-cli): findProjectRoot helper for poster bundler"
```

### Task 2.3: `bundlePoster()` — esbuild wrapper

**Files:**
- Create: `packages/matter-cli/src/poster/bundle.ts`
- Create: `packages/matter-cli/src/poster/bundle.test.ts`
- Create: `packages/matter-cli/src/test-fixtures/posters/trivial.tsx`

- [ ] **Step 1: Create a minimal fixture (no Matter deps yet — pure React)**

Create `packages/matter-cli/src/test-fixtures/posters/trivial.tsx`:

```tsx
export default function Trivial() {
  return <div>hello</div>
}

export function Named() {
  return <div>named</div>
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/matter-cli/src/poster/bundle.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { bundlePoster } from './bundle.js'

const FIXTURE_DIR = new URL('../test-fixtures/posters/', import.meta.url).pathname

describe('bundlePoster', () => {
  it('produces an ESM bundle that references the resolved user module', async () => {
    const result = await bundlePoster({
      from: `${FIXTURE_DIR}trivial.tsx`,
      exportName: 'default',
      projectRoot: new URL('../../', import.meta.url).pathname, // matter-cli's own root, has react installed
    })
    expect(result.js).toContain('hello')
    expect(result.js.length).toBeGreaterThan(1000)
  })

  it('surfaces esbuild errors as Error', async () => {
    await expect(
      bundlePoster({
        from: `${FIXTURE_DIR}__does_not_exist__.tsx`,
        exportName: 'default',
        projectRoot: new URL('../../', import.meta.url).pathname,
      }),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Run; expect failure (module missing)**

```bash
pnpm --filter @lovo/matter-cli test src/poster/bundle.test.ts
```
Expected: "Cannot find module './bundle.js'".

- [ ] **Step 4: Implement `bundlePoster()`**

Create `packages/matter-cli/src/poster/bundle.ts`:

```ts
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

  const out = result.outputFiles?.find((f) => f.path.endsWith('index.js'))
  if (!out) throw new Error('bundlePoster: esbuild produced no output')
  const html = await readFile(join(HARNESS_DIR, 'index.html'), 'utf-8')
  return { js: out.text, html }
}
```

> **Note on `HARNESS_DIR`:** at dev/test time the harness lives in `src/harness/`; after `tsup` build it lives in `dist/harness/`. The replacement above handles both. Phase 7 (Task 7.3) confirms the dist layout matches.

- [ ] **Step 5: Run tests; expect pass**

```bash
pnpm --filter @lovo/matter-cli test src/poster/bundle.test.ts
```
Expected: 2 passing tests.

- [ ] **Step 6: Commit**

```bash
git add packages/matter-cli/src/poster/bundle.ts packages/matter-cli/src/poster/bundle.test.ts packages/matter-cli/src/test-fixtures/posters/trivial.tsx
git commit -m "feat(matter-cli): bundlePoster wraps esbuild for poster harness"
```

### GATE 2 — Validate

Manually bundle the trivial fixture and inspect:

```bash
cd packages/matter-cli && node --input-type=module -e "
  import('./src/poster/bundle.ts').then(async ({ bundlePoster }) => {
    const r = await bundlePoster({
      from: new URL('./src/test-fixtures/posters/trivial.tsx', import.meta.url).pathname,
      exportName: 'default',
      projectRoot: process.cwd(),
    });
    console.log('JS length:', r.js.length, 'HTML length:', r.html.length);
  })
"
```

Expected: prints two non-zero lengths; no errors. If you want to read the bundle, write `r.js` to a file and open it.

---

## Phase 3 — Ephemeral HTTP server (TDD-able)

End state: `createPosterServer({ bundle })` starts on a random port and serves `/`, `/harness.js`, `/config.json`. Manually openable in a real browser.

### Task 3.1: `createPosterServer()`

**Files:**
- Create: `packages/matter-cli/src/poster/server.ts`
- Create: `packages/matter-cli/src/poster/server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/matter-cli/src/poster/server.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createPosterServer, type PosterServer } from './server.js'

const bundle = {
  html: '<!doctype html><html><body>ok</body></html>',
  js: 'console.log("bundle")',
}

let server: PosterServer

beforeEach(async () => {
  server = await createPosterServer({ bundle, config: { width: 1280, height: 720 } })
})

afterEach(async () => {
  await server.close()
})

describe('createPosterServer', () => {
  it('listens on a random localhost port', () => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  it('serves the harness HTML at /', async () => {
    const res = await fetch(`${server.url}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(await res.text()).toContain('ok')
  })

  it('serves the harness JS at /harness.js', async () => {
    const res = await fetch(`${server.url}/harness.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/javascript/)
    expect(await res.text()).toContain('bundle')
  })

  it('serves the render config as JSON at /config.json', async () => {
    const res = await fetch(`${server.url}/config.json`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { width: number; height: number }
    expect(json.width).toBe(1280)
    expect(json.height).toBe(720)
  })

  it('404s unknown paths', async () => {
    const res = await fetch(`${server.url}/nope`)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run; expect failure (module missing)**

```bash
pnpm --filter @lovo/matter-cli test src/poster/server.test.ts
```

- [ ] **Step 3: Implement**

Create `packages/matter-cli/src/poster/server.ts`:

```ts
import { createServer, type Server } from 'node:http'
import { AddressInfo } from 'node:net'

export interface PosterBundle {
  html: string
  js: string
}

export interface PosterRenderConfig {
  width: number
  height: number
}

export interface PosterServer {
  url: string
  close: () => Promise<void>
}

export async function createPosterServer(opts: {
  bundle: PosterBundle
  config: PosterRenderConfig
}): Promise<PosterServer> {
  const server: Server = createServer((req, res) => {
    const url = req.url ?? '/'

    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(opts.bundle.html)
      return
    }
    if (url === '/harness.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
      res.end(opts.bundle.js)
      return
    }
    if (url === '/config.json') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(opts.config))
      return
    }
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const addr = server.address() as AddressInfo
  const url = `http://127.0.0.1:${addr.port}`

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      }),
  }
}
```

- [ ] **Step 4: Run; expect pass**

```bash
pnpm --filter @lovo/matter-cli test src/poster/server.test.ts
```
Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/matter-cli/src/poster/server.ts packages/matter-cli/src/poster/server.test.ts
git commit -m "feat(matter-cli): ephemeral HTTP server for poster harness"
```

### Task 3.2: A Matter fixture that exercises the bundler against the real workspace deps

**Files:**
- Create: `packages/matter-cli/src/test-fixtures/posters/single-linear-gradient.tsx`

- [ ] **Step 1: Write the fixture**

Create `packages/matter-cli/src/test-fixtures/posters/single-linear-gradient.tsx`:

```tsx
import { LinearGradient, ShaderScene } from '@lovo/matter-react'

export default function SingleLinearGradient() {
  return (
    <ShaderScene>
      <LinearGradient colors={['#ff00aa', '#00ffaa']} stops={[0, 1]} />
    </ShaderScene>
  )
}
```

> **Note:** this fixture only works when the matter-cli package can resolve `@lovo/matter-react` via the workspace. We're inside the workspace, so that's fine.

- [ ] **Step 2: Smoke-test the bundle locally (no commit yet — this is exploratory)**

```bash
pnpm --filter @lovo/matter-cli build
cd packages/matter-cli && node --input-type=module -e "
  const { bundlePoster } = await import('./dist/poster/bundle.js');
  const r = await bundlePoster({
    from: new URL('./src/test-fixtures/posters/single-linear-gradient.tsx', import.meta.url).pathname,
    exportName: 'default',
    projectRoot: process.cwd(),
  });
  console.log('bundle bytes:', r.js.length);
"
```

Expected: prints a bundle size in the hundreds of KB to ~MBs (three is large). If esbuild reports unresolved imports for `@lovo/matter-react` or `three/webgpu`, check that the package's own `node_modules/.pnpm/...` symlinks exist (running `pnpm install` at the repo root fixes this).

- [ ] **Step 3: Commit the fixture**

```bash
git add packages/matter-cli/src/test-fixtures/posters/single-linear-gradient.tsx
git commit -m "test(matter-cli): single-linear-gradient poster fixture"
```

### GATE 3 — Manual browser validation

Wire the bundle into the server and open it in your real browser. Add a temporary throwaway script:

```bash
cd packages/matter-cli && node --input-type=module -e "
  const { bundlePoster } = await import('./dist/poster/bundle.js');
  const { createPosterServer } = await import('./dist/poster/server.js');
  const bundle = await bundlePoster({
    from: new URL('./src/test-fixtures/posters/single-linear-gradient.tsx', import.meta.url).pathname,
    exportName: 'default',
    projectRoot: process.cwd(),
  });
  const server = await createPosterServer({ bundle, config: { width: 1280, height: 720 } });
  console.log('Open in browser:', server.url);
  // Leave running; Ctrl+C to stop.
"
```

Expected: open the printed URL in Chrome with WebGPU enabled. You should see the LinearGradient animating fullscreen on a black page. (If WebGPU is unavailable, Matter falls back to WebGL2; either is fine.)

**This is a "stop and play" beat.** Drag the window to confirm it resizes. Open DevTools, check the Console for warnings. If anything looks wrong, fix it before continuing.

When done: Ctrl+C the server, no commit needed (the snippet was throwaway).

---

## Phase 4 — Frame-ready signal in harness

End state: harness sets `window.__matterReady = true` once the canvas has any non-blank pixels. Manually verifiable.

### Task 4.1: Implement `installFrameReadyWatcher()`

**Files:**
- Modify: `packages/matter-cli/src/harness/frameReady.ts`

- [ ] **Step 1: Replace the stub with the real watcher**

Replace the body of `packages/matter-cli/src/harness/frameReady.ts` with:

```ts
declare global {
  interface Window {
    __matterReady?: boolean
  }
}

const NOISE_FLOOR = 2
const SAMPLE_SIZE = 4

export function installFrameReadyWatcher(): void {
  const tick = (): void => {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      if (isNonBlank(canvas)) {
        window.__matterReady = true
        return
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function isNonBlank(canvas: HTMLCanvasElement): boolean {
  try {
    // Backend-agnostic: read the canvas as an image via an offscreen 2D context.
    // Note: WebGPU/WebGL canvases support drawImage into a 2D context as long
    // as preserveDrawingBuffer or auto-clear behaviour hasn't already wiped them
    // for the frame we're sampling. We tick on rAF so we sample after Matter's
    // render call but before the browser's compositor clears.
    const off = document.createElement('canvas')
    off.width = SAMPLE_SIZE
    off.height = SAMPLE_SIZE
    const ctx = off.getContext('2d')
    if (!ctx) return false
    const sx = Math.max(0, Math.floor(canvas.width / 2) - SAMPLE_SIZE / 2)
    const sy = Math.max(0, Math.floor(canvas.height / 2) - SAMPLE_SIZE / 2)
    ctx.drawImage(canvas, sx, sy, SAMPLE_SIZE, SAMPLE_SIZE, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      if (r > NOISE_FLOOR || g > NOISE_FLOOR || b > NOISE_FLOOR) return true
    }
    return false
  } catch {
    return false
  }
}
```

> **Note on `drawImage(canvas, …)`:** WebGPU canvases ARE drawable into a 2D context. The canvas just needs to have been drawn into at least once this frame; rAF gives us that ordering.

- [ ] **Step 2: Build the CLI (so dist/harness picks up the updated frameReady.ts)**

```bash
pnpm --filter @lovo/matter-cli build
ls packages/matter-cli/dist/harness/
```
Expected: `frameReady.ts` was copied into dist with the updated implementation.

- [ ] **Step 3: Commit**

```bash
git add packages/matter-cli/src/harness/frameReady.ts
git commit -m "feat(matter-cli): frame-ready pixel sampler for poster harness"
```

### GATE 4 — Manual browser validation

Re-run the dev snippet from Gate 3. Open DevTools Console and type:

```js
window.__matterReady
```

Expected: `true` within 1–2 seconds of page load. (If you load the page first and the shader is already running, it should be `true` immediately.)

Negative test: tweak the fixture to render nothing (e.g., return `<></>`), re-run, confirm `window.__matterReady` stays `undefined`. Revert when done.

---

## Phase 5 — Playwright orchestration

End state: `matter-cli poster --from <fixture> --out /tmp/p.png` produces a real PNG. The full pipeline works.

### Task 5.1: Add `playwright` as an optional peer dep

**Files:**
- Modify: `packages/matter-cli/package.json`

- [ ] **Step 1: Add the peer dep**

Edit `packages/matter-cli/package.json`. Add:

```json
  "peerDependencies": {
    "playwright": "*"
  },
  "peerDependenciesMeta": {
    "playwright": {
      "optional": true
    }
  },
```

Also add `playwright` to `devDependencies` so the matter-cli package itself can run its own E2E tests:

```json
    "playwright": "^1.50.0",
```

- [ ] **Step 2: Install and download Chromium**

```bash
pnpm install
pnpm exec playwright install chromium
```

Expected: install succeeds; chromium downloads (~150MB on first run).

- [ ] **Step 3: Commit**

```bash
git add packages/matter-cli/package.json pnpm-lock.yaml
git commit -m "feat(matter-cli): add playwright as optional peer dep for poster"
```

### Task 5.2: `launchAndScreenshot()` — wraps Playwright

**Files:**
- Create: `packages/matter-cli/src/poster/playwright.ts`
- Create: `packages/matter-cli/src/poster/playwright.test.ts`

- [ ] **Step 1: Write the test (for the missing-peer-dep branch only — Playwright integration tested in E2E)**

Create `packages/matter-cli/src/poster/playwright.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { resolvePlaywright } from './playwright.js'

describe('resolvePlaywright', () => {
  it('returns the playwright module if installed in the project', async () => {
    // matter-cli itself has playwright as a devDep, so resolution from its own
    // project root must succeed.
    const cliRoot = new URL('../../', import.meta.url).pathname
    const pw = await resolvePlaywright(cliRoot)
    expect(pw).toBeDefined()
    expect(typeof pw.chromium.launch).toBe('function')
  })

  it('throws a helpful error when playwright is missing', async () => {
    // /tmp has no playwright. Use a fresh tmpdir to be safe.
    const { mkdtemp } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = await mkdtemp(join(tmpdir(), 'matter-no-pw-'))
    await expect(resolvePlaywright(dir)).rejects.toThrow(
      /Install playwright to use this command/,
    )
  })
})
```

- [ ] **Step 2: Run; expect failure (module missing)**

```bash
pnpm --filter @lovo/matter-cli test src/poster/playwright.test.ts
```

- [ ] **Step 3: Implement**

Create `packages/matter-cli/src/poster/playwright.ts`:

```ts
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import type * as Playwright from 'playwright'

export async function resolvePlaywright(projectRoot: string): Promise<typeof Playwright> {
  const require = createRequire(`${projectRoot}/__matter_poster_resolver__.cjs`)
  let pwPath: string
  try {
    pwPath = require.resolve('playwright')
  } catch {
    throw new Error(
      `Install playwright to use this command: pnpm add -D playwright && pnpm exec playwright install chromium`,
    )
  }
  // Resolve relative to the CJS-style path we just got, but import as ESM-compatible.
  const mod = (await import(pwPath)) as typeof Playwright
  return mod
}

export interface ScreenshotOpts {
  url: string
  width: number
  height: number
  timeSeconds: number
  readyTimeoutMs: number
  outPath: string
  projectRoot: string
}

export async function launchAndScreenshot(opts: ScreenshotOpts): Promise<{ bytes: number }> {
  const pw = await resolvePlaywright(opts.projectRoot)
  const browser = await pw.chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: 1,
    })
    const page = await ctx.newPage()
    const consoleErrors: string[] = []
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`)
    })
    await page.goto(opts.url, { waitUntil: 'load' })
    try {
      await page.waitForFunction(() => (window as { __matterReady?: boolean }).__matterReady === true, {
        timeout: opts.readyTimeoutMs,
      })
    } catch {
      if (consoleErrors.length > 0) {
        throw new Error(
          `Poster render failed before producing a frame:\n  ${consoleErrors.join('\n  ')}`,
        )
      }
      throw new Error(
        `no canvas content detected within ${opts.readyTimeoutMs / 1000}s; does your component render a ShaderScene with a visible base layer?`,
      )
    }
    if (opts.timeSeconds > 0) {
      await page.waitForTimeout(opts.timeSeconds * 1000)
    }
    const canvas = page.locator('canvas').first()
    const buf = await canvas.screenshot({ type: 'png' })
    await writeFile(opts.outPath, buf)
    return { bytes: buf.length }
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 4: Run tests; expect pass**

```bash
pnpm --filter @lovo/matter-cli test src/poster/playwright.test.ts
```
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/matter-cli/src/poster/playwright.ts packages/matter-cli/src/poster/playwright.test.ts
git commit -m "feat(matter-cli): launchAndScreenshot — Playwright orchestration"
```

### Task 5.3: Wire it all up in `runPoster`

**Files:**
- Modify: `packages/matter-cli/src/commands/poster.ts`
- Modify: `packages/matter-cli/src/commands/poster.test.ts`

- [ ] **Step 1: Replace `runPoster` body with the full pipeline**

Edit `packages/matter-cli/src/commands/poster.ts`. Replace the file with:

```ts
import { mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { bundlePoster } from '../poster/bundle.js'
import { launchAndScreenshot } from '../poster/playwright.js'
import { findProjectRoot } from '../poster/projectRoot.js'
import { createPosterServer } from '../poster/server.js'

export interface PosterOptions {
  from: string
  out: string
  exportName: string
  timeSeconds: number
  width: number
  height: number
}

export interface PosterIO {
  cwd: string
  log: (line: string) => void
}

const READY_TIMEOUT_MS = 10_000

export async function runPoster(
  opts: PosterOptions,
  io: PosterIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  if (!Number.isInteger(opts.width) || opts.width <= 0 || opts.width > 4096) {
    throw new Error(`--width must be a positive integer ≤ 4096 (got ${opts.width})`)
  }
  if (!Number.isInteger(opts.height) || opts.height <= 0 || opts.height > 4096) {
    throw new Error(`--height must be a positive integer ≤ 4096 (got ${opts.height})`)
  }
  if (!Number.isFinite(opts.timeSeconds) || opts.timeSeconds < 0) {
    throw new Error(`--time must be ≥ 0 (got ${opts.timeSeconds})`)
  }

  const fromAbs = resolve(io.cwd, opts.from)
  const outAbs = resolve(io.cwd, opts.out)

  try {
    await stat(fromAbs)
  } catch {
    throw new Error(`--from ${opts.from}: file not found`)
  }

  const projectRoot = await findProjectRoot(fromAbs)
  const bundle = await bundlePoster({
    from: fromAbs,
    exportName: opts.exportName,
    projectRoot,
  })

  const server = await createPosterServer({
    bundle,
    config: { width: opts.width, height: opts.height },
  })

  try {
    await mkdir(dirname(outAbs), { recursive: true })
    const { bytes } = await launchAndScreenshot({
      url: server.url,
      width: opts.width,
      height: opts.height,
      timeSeconds: opts.timeSeconds,
      readyTimeoutMs: READY_TIMEOUT_MS,
      outPath: outAbs,
      projectRoot,
    })
    io.log(`Wrote poster: ${opts.out} (${opts.width}×${opts.height}, ${formatBytes(bytes)})`)
    io.log('')
    io.log(`Wire it up inside ${opts.from}:`)
    io.log('  <ShaderScene fallback={<img src="' + posterPublicSrc(opts.out) + '" alt="" />}>')
    io.log('    ...')
    io.log('  </ShaderScene>')
  } finally {
    await server.close()
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function posterPublicSrc(outPath: string): string {
  // Best-effort hint: if the path goes through `/public/`, suggest the served form.
  const idx = outPath.replace(/\\/g, '/').indexOf('/public/')
  if (idx >= 0) return outPath.replace(/\\/g, '/').slice(idx + '/public'.length)
  return outPath
}
```

- [ ] **Step 2: Update the existing test for the new "--from not found" error message**

Append to `packages/matter-cli/src/commands/poster.test.ts`:

```ts
describe('runPoster — --from validation', () => {
  it('throws if --from file does not exist', async () => {
    await expect(
      runPoster(
        { ...base, from: '/tmp/__matter_test_missing__.tsx' },
        { cwd: '/tmp', log: vi.fn() },
      ),
    ).rejects.toThrow(/--from .* file not found/)
  })
})
```

- [ ] **Step 3: Run unit tests; expect pass**

```bash
pnpm --filter @lovo/matter-cli test src/commands/poster.test.ts
```
Expected: 5 passing tests (4 from earlier + new one).

- [ ] **Step 4: Run typecheck**

```bash
pnpm --filter @lovo/matter-cli typecheck
```
Expected: no errors.

- [ ] **Step 5: Build**

```bash
pnpm --filter @lovo/matter-cli build
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/matter-cli/src/commands/poster.ts packages/matter-cli/src/commands/poster.test.ts
git commit -m "feat(matter-cli): wire poster command end-to-end"
```

### GATE 5 — Full pipeline validation

```bash
node packages/matter-cli/dist/index.js poster \
  --from packages/matter-cli/src/test-fixtures/posters/single-linear-gradient.tsx \
  --out /tmp/test-poster.png
```

Expected: command exits 0, prints `Wrote poster: /tmp/test-poster.png (1280×720, ~XX KB)` and a wiring snippet. Open `/tmp/test-poster.png` in any image viewer — you should see a frame of the pink-to-mint linear gradient.

**This is a "stop and play" beat.** Try a few variations:
- `--width 800 --height 800` → square
- `--time 2` → wait 2 seconds before snapshot
- `--from <nonexistent>` → error message

If anything's off, fix it before continuing to Phase 6.

---

## Phase 6 — Error handling polish

End state: every error case in the spec exits 1 with a useful message; covered by tests.

### Task 6.1: Surface esbuild diagnostics cleanly

**Files:**
- Modify: `packages/matter-cli/src/poster/bundle.ts`
- Modify: `packages/matter-cli/src/poster/bundle.test.ts`

- [ ] **Step 1: Write a failing test for the error-message format**

Append to `packages/matter-cli/src/poster/bundle.test.ts`:

```ts
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('bundlePoster — error messages', () => {
  it('surfaces a TS/JSX syntax error with the user file path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'matter-bundle-err-'))
    await writeFile(join(dir, 'package.json'), '{}')
    const bad = join(dir, 'bad.tsx')
    await writeFile(bad, 'export default function Bad() { return <div></span> }')

    await expect(
      bundlePoster({ from: bad, exportName: 'default', projectRoot: dir }),
    ).rejects.toThrow(/bad\.tsx/)
  })
})
```

- [ ] **Step 2: Run; expect failure (current implementation swallows diagnostics — logLevel: 'silent')**

```bash
pnpm --filter @lovo/matter-cli test src/poster/bundle.test.ts
```

- [ ] **Step 3: Implement — catch esbuild's BuildFailure and rethrow with formatted diagnostic**

In `packages/matter-cli/src/poster/bundle.ts`, wrap the `build({ ... })` call:

```ts
  try {
    const result = await build({
      // ...existing options...
    })
    // ...existing post-processing...
  } catch (err) {
    const e = err as { errors?: Array<{ text: string; location?: { file?: string; line?: number; column?: number } }> }
    if (Array.isArray(e.errors) && e.errors.length > 0) {
      const formatted = e.errors
        .map((d) => {
          const loc = d.location
            ? ` (${d.location.file ?? '?'}:${d.location.line ?? '?'}:${d.location.column ?? '?'})`
            : ''
          return `${d.text}${loc}`
        })
        .join('\n  ')
      throw new Error(`Failed to bundle ${opts.from}:\n  ${formatted}`)
    }
    throw err
  }
```

- [ ] **Step 4: Run; expect pass**

```bash
pnpm --filter @lovo/matter-cli test src/poster/bundle.test.ts
```
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/matter-cli/src/poster/bundle.ts packages/matter-cli/src/poster/bundle.test.ts
git commit -m "feat(matter-cli): format esbuild diagnostics in poster errors"
```

### Task 6.2: Detect missing `--export` and list available exports

**Files:**
- Modify: `packages/matter-cli/src/harness/index.tsx`

(The current harness already shows a body-level error if the export isn't a function; we need to make sure Playwright surfaces it. Already handled in `launchAndScreenshot` via `pageerror`. Verify with a test.)

**Files:**
- Create: `packages/matter-cli/src/test-fixtures/posters/named-export.tsx`

- [ ] **Step 1: Create the named-export fixture**

```tsx
import { LinearGradient, ShaderScene } from '@lovo/matter-react'

export function NamedExport() {
  return (
    <ShaderScene>
      <LinearGradient colors={['#102', '#204']} />
    </ShaderScene>
  )
}
```

- [ ] **Step 2: Verify manually (not committed yet)**

```bash
node packages/matter-cli/dist/index.js poster \
  --from packages/matter-cli/src/test-fixtures/posters/named-export.tsx \
  --out /tmp/p1.png
```
Expected: fails with a useful error mentioning that `default` is not exported (the available exports include `NamedExport`).

Then:
```bash
node packages/matter-cli/dist/index.js poster \
  --from packages/matter-cli/src/test-fixtures/posters/named-export.tsx \
  --export NamedExport \
  --out /tmp/p2.png
```
Expected: succeeds, /tmp/p2.png is a dark blue gradient.

- [ ] **Step 3: Commit the fixture**

```bash
git add packages/matter-cli/src/test-fixtures/posters/named-export.tsx
git commit -m "test(matter-cli): named-export poster fixture"
```

### Task 6.3: Composition fixture (gradient + grain)

**Files:**
- Create: `packages/matter-cli/src/test-fixtures/posters/gradient-plus-grain.tsx`

- [ ] **Step 1: Create the fixture**

```tsx
import { Grain, LinearGradient, ShaderScene } from '@lovo/matter-react'

export default function GradientPlusGrain() {
  return (
    <ShaderScene>
      <LinearGradient colors={['#1a0b2e', '#3a1e6e']} stops={[0, 1]} />
      <Grain intensity={0.3} mode="additive" />
    </ShaderScene>
  )
}
```

- [ ] **Step 2: Smoke-test manually**

```bash
node packages/matter-cli/dist/index.js poster \
  --from packages/matter-cli/src/test-fixtures/posters/gradient-plus-grain.tsx \
  --out /tmp/grain.png
```
Expected: a dark purple gradient with visible grain.

- [ ] **Step 3: Commit**

```bash
git add packages/matter-cli/src/test-fixtures/posters/gradient-plus-grain.tsx
git commit -m "test(matter-cli): gradient+grain composition poster fixture"
```

### Task 6.4: Aurora-with-time fixture

**Files:**
- Create: `packages/matter-cli/src/test-fixtures/posters/aurora-with-time.tsx`

- [ ] **Step 1: Create the fixture**

```tsx
import { Aurora, ShaderScene } from '@lovo/matter-react'

export default function AuroraWithTime() {
  return (
    <ShaderScene>
      <Aurora colors={['#003a4a', '#7affc0', '#0a206e']} />
    </ShaderScene>
  )
}
```

- [ ] **Step 2: Smoke-test with and without `--time`**

```bash
# Snapshot at first non-blank frame (probably very dark)
node packages/matter-cli/dist/index.js poster \
  --from packages/matter-cli/src/test-fixtures/posters/aurora-with-time.tsx \
  --out /tmp/aurora-t0.png

# Let it develop for 3 seconds
node packages/matter-cli/dist/index.js poster \
  --from packages/matter-cli/src/test-fixtures/posters/aurora-with-time.tsx \
  --out /tmp/aurora-t3.png --time 3
```
Expected: `aurora-t3.png` is visibly more vibrant than `aurora-t0.png`.

- [ ] **Step 3: Commit**

```bash
git add packages/matter-cli/src/test-fixtures/posters/aurora-with-time.tsx
git commit -m "test(matter-cli): aurora-with-time poster fixture"
```

### GATE 6 — Manual error-path validation

Run each negative case and confirm the message reads clearly:

```bash
# missing --from file
node packages/matter-cli/dist/index.js poster --from /tmp/__missing__.tsx --out /tmp/x.png

# wrong --export
node packages/matter-cli/dist/index.js poster \
  --from packages/matter-cli/src/test-fixtures/posters/named-export.tsx --out /tmp/x.png

# invalid --width
node packages/matter-cli/dist/index.js poster --from /tmp/x.tsx --out /tmp/x.png --width 0

# syntax error in user file (write a temp file with broken JSX, point at it)
echo 'export default function() { return <div></span> }' > /tmp/broken.tsx
node packages/matter-cli/dist/index.js poster --from /tmp/broken.tsx --out /tmp/x.png
```

Expected: each exits 1 with a message that reads well. If any are unclear, fix the corresponding error site.

---

## Phase 7 — E2E tests, docs, final polish

End state: E2E tests pass under `MATTER_E2E=1`; CLI README documents the command.

### Task 7.1: E2E test suite (env-gated)

**Files:**
- Create: `packages/matter-cli/src/poster/e2e.test.ts`

- [ ] **Step 1: Write the gated E2E tests**

Create `packages/matter-cli/src/poster/e2e.test.ts`:

```ts
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runPoster } from '../commands/poster.js'

const E2E_ENABLED = process.env.MATTER_E2E === '1'

const FIXTURES = new URL('../test-fixtures/posters/', import.meta.url).pathname

const cases = [
  { name: 'single-linear-gradient', file: 'single-linear-gradient.tsx', extra: {} },
  { name: 'gradient-plus-grain', file: 'gradient-plus-grain.tsx', extra: {} },
  { name: 'aurora-with-time', file: 'aurora-with-time.tsx', extra: { timeSeconds: 2 } },
  {
    name: 'named-export',
    file: 'named-export.tsx',
    extra: { exportName: 'NamedExport' },
  },
] as const

describe.skipIf(!E2E_ENABLED)('runPoster — E2E (MATTER_E2E=1)', () => {
  let outDir: string

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'matter-poster-e2e-'))
  })

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true })
  })

  for (const c of cases) {
    it(`produces a PNG for ${c.name}`, async () => {
      const out = join(outDir, `${c.name}.png`)
      await runPoster(
        {
          from: join(FIXTURES, c.file),
          out,
          exportName: 'default',
          timeSeconds: 0,
          width: 800,
          height: 600,
          ...c.extra,
        },
        { cwd: process.cwd(), log: vi.fn() },
      )
      const s = await stat(out)
      expect(s.size).toBeGreaterThan(1024) // > 1 KB
      expect(s.size).toBeLessThan(5 * 1024 * 1024) // < 5 MB
    }, 30_000)
  }
})
```

- [ ] **Step 2: Run without the env var; confirm tests are skipped**

```bash
pnpm --filter @lovo/matter-cli test src/poster/e2e.test.ts
```
Expected: tests skipped, suite passes vacuously.

- [ ] **Step 3: Run with `MATTER_E2E=1`; expect all four to pass**

```bash
MATTER_E2E=1 pnpm --filter @lovo/matter-cli test src/poster/e2e.test.ts
```
Expected: 4 passing tests, each writes a PNG, sizes are sensible. May take 30-60 seconds total.

- [ ] **Step 4: Commit**

```bash
git add packages/matter-cli/src/poster/e2e.test.ts
git commit -m "test(matter-cli): E2E poster tests gated on MATTER_E2E=1"
```

### Task 7.2: Document the command

**Files:**
- Modify: `packages/matter-cli/README.md`

- [ ] **Step 1: Read the current README so the addition matches its tone**

```bash
cat packages/matter-cli/README.md
```

- [ ] **Step 2: Add a `## poster` section**

Append (or insert in the same place `add`, `update`, `list` are documented):

````markdown
### `poster`

Render a Matter component tree to a static PNG for use as a `<ShaderScene fallback>` — eliminates the visible blank canvas during WebGPU initialization.

```bash
matter poster --from <file> --out <path> [options]
```

| Flag                 | Default     | Description                                                                                |
| -------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `--from <file>`      | (required)  | Path to a `.tsx`/`.ts` file whose chosen export renders the full tree (must include `<ShaderScene>`) |
| `--out <path>`       | (required)  | Where to write the PNG. Parent directories are created automatically.                      |
| `--export <name>`    | `default`   | Named export to render.                                                                    |
| `--time <seconds>`   | `0`         | Wait this long after the first non-blank frame before snapshotting.                        |
| `--width <px>`       | `1280`      | Render width.                                                                              |
| `--height <px>`      | `720`       | Render height.                                                                             |

**Requires Playwright** as a peer dependency:

```bash
pnpm add -D playwright
pnpm exec playwright install chromium
```

**Example:**

```bash
matter poster --from ./src/components/matter/hero.tsx --out ./public/hero.png
```

Wire it up:

```tsx
<ShaderScene fallback={<img src="/hero.png" alt="" />}>
  <LinearGradient ... />
</ShaderScene>
```

**Limitations:**

- The component you point at must render the entire tree (including `<ShaderScene>`); the CLI doesn't wrap.
- Components that depend on app-context hooks (`useTheme`, `useRouter`, etc.) won't render in the headless harness. Extract a presentational child.
- Output is always PNG (animated formats, JPG, WebP are out of scope for v1).
````

- [ ] **Step 3: Commit**

```bash
git add packages/matter-cli/README.md
git commit -m "docs(matter-cli): document poster command"
```

### Task 7.3: Verification

Use the verification-before-completion skill before declaring done.

- [ ] **Step 1: All unit tests pass**

```bash
pnpm --filter @lovo/matter-cli test
```
Expected: all green, no failures, e2e tests skipped.

- [ ] **Step 2: E2E tests pass**

```bash
MATTER_E2E=1 pnpm --filter @lovo/matter-cli test
```
Expected: all green, 4 E2E tests pass.

- [ ] **Step 3: Typecheck and lint pass workspace-wide**

```bash
pnpm typecheck
pnpm lint
```
Expected: clean.

- [ ] **Step 4: Format check**

```bash
pnpm format:check
```
Expected: clean. If not: `pnpm format` and commit the result.

- [ ] **Step 5: Smoke test from the user perspective (one final manual run)**

```bash
rm -f /tmp/final-smoke.png
node packages/matter-cli/dist/index.js poster \
  --from packages/matter-cli/src/test-fixtures/posters/gradient-plus-grain.tsx \
  --out /tmp/final-smoke.png \
  --width 1920 --height 1080
open /tmp/final-smoke.png   # or xdg-open on Linux
```
Expected: dark purple gradient with grain at 1920×1080.

### GATE 7 — Done

Everything green. The command is shippable. Open `/tmp/final-smoke.png` one more time and feel it — would *you* use this as a fallback under a real-time-rendered LinearGradient?

If yes: ready for review and merge.
If no: capture what's missing as a follow-up issue; the spec/plan are intentionally v1-tight.
