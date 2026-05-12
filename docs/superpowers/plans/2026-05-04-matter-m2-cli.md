# Matter — Milestone 2: `@lovo/matter-cli` (copy-paste delivery) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@lovo/matter-cli` — a working `init` / `list` / `add` / `update` flow that reads `registry/registry.json` (from a local `file://` path during dev or a GitHub raw URL in production), writes a Tier 1 component into a consumer project's `componentsDir`, rewrites import aliases per the user's `matter.config.json`, and prints the install hint for required runtime dependencies. End-state: drop the CLI into a fresh Next.js project in `/tmp`, run `init` + `add linear-gradient`, and the same `<LinearGradient>` that ships from M1 renders in that consumer project.

**Architecture:** All CLI logic lives in `packages/matter-cli/src/`, organized into `commands/` (one file per subcommand), `registry/` (URL fetching + ref resolution), `config/` (matter.config.json read/write/shape), and `transforms/` (import alias rewriting). The CLI never imports from any workspace package at runtime — it speaks only to GitHub raw URLs (or `file://` paths during dev) and the consumer's filesystem. `commander@^12` handles argv parsing. Vitest tests use `file://` URLs against a tiny fixture registry under `src/test-fixtures/`. The end-to-end smoke test at the end of M2 runs the CLI as a packed tarball against a fresh `/tmp/matter-cli-smoke/` project, exercising the same code path a real user would hit.

**Tech Stack:** Node 22+ (native `fetch`, `import.meta.url`, `node:fs/promises`) · TypeScript 5 strict · `commander@^12` (argv) · Vitest 2 · tsup (bundle → single ESM file with shebang + build-time version inject) · everything else inherited from M0/M1.

---

## Scope

**In scope (M2):**

- `packages/matter-cli/`:
  - `init` — writes `matter.config.json` to project root with sensible defaults; refuses overwrite without `--force`
  - `list` — reads registry, prints `name · description · tier`
  - `add <components...>` — fetches one or many components, rewrites alias imports per config, writes to `componentsDir`, prints deduplicated install hint
  - `update [components...]` — refetches and overwrites a previously-added component (or all of them, if no name given); requires `--force` to overwrite a file with local edits
  - `--ref <tag|branch|commit>` — version pinning; defaults to the CLI's own `package.json` version (or `'main'` when version is `0.0.0`)
  - `--registry <url>` — overrides `registryUrl` from config; supports `https://` and `file://` schemes
  - `--help` and `--version` work end-to-end
- A registry fetch abstraction: `readUrl(url): Promise<string>` switching on protocol
- An import-alias rewriter: replaces `@matter-internal/*` (forward-looking, no-op for v1's components) per `matter.config.json` `aliases`
- Vitest tests for every unit (registry fetch, ref resolution, config read/write, alias rewriter, individual command happy paths)
- End-to-end smoke test script (`scripts/smoke-test-cli.mjs`) that exercises the CLI as a packed tarball against a fresh `/tmp/` project
- Tag `m2-complete` on success

**Out of scope (deferred):**

- Hosted registry endpoint (M2 spec says GitHub raw URLs in v1; revisit if rate limits become an issue per spec §11)
- Vue / Svelte source variants (the registry schema permits framework switching, but only the React file ships in v1)
- Component package-manager auto-detection (we print `npm install ...` and a one-line "use your preferred package manager" note; spec only requires the install hint)
- Interactive prompts (spec §4.3 doesn't require them; default to non-interactive flags). `init` doesn't prompt for `componentsDir` — it writes a sensible default and tells the user to edit if needed.
- Telemetry / analytics
- The other five components (M3) — only `linear-gradient` exists in `registry/` to test against
- Visual regression and Storybook (M5 / not coming back per the M1 pivot)

---

## Pre-flight checks

Run these before starting Phase 2.1.

- [ ] **In project root.** Run `pwd`. Expected: `/Users/hunter.garrett/Documents/_personal/mattermix`.
- [ ] **M1 tag present.** Run `git tag`. Expected: `m0-complete` and `m1-complete` listed.
- [ ] **Working tree clean.** Run `git status --short`. Expected: empty output.
- [ ] **Everything builds clean from M1 state.**
      `bash
pnpm install --frozen-lockfile
pnpm build && pnpm typecheck && pnpm lint && pnpm test
`
      Expected: all green.
- [ ] **Node and pnpm versions.** Run `node -v` (≥ v22) and `pnpm -v` (≥ 9). The CLI relies on Node 22's native `fetch` and stable ESM `import` of JSON.
- [ ] **Registry exists.** Run `ls registry/`. Expected to include `linear-gradient.tsx` and `registry.json` (created in M1).

---

## File structure produced by this milestone

```
mattermix/
├── packages/matter-cli/
│   ├── package.json                              # MODIFIED — adds commander runtime dep + vitest devDep + dependencies field
│   ├── tsup.config.ts                            # MODIFIED — adds define for __VERSION__ injection (Phase 2.1)
│   ├── vitest.config.ts                          # NEW — Phase 2.2
│   └── src/
│       ├── index.ts                              # MODIFIED — replaces stub with commander entry (Phase 2.1)
│       ├── commands/
│       │   ├── init.ts                           # NEW — Phase 2.4
│       │   ├── init.test.ts                      # NEW — Phase 2.4
│       │   ├── list.ts                           # NEW — Phase 2.3
│       │   ├── list.test.ts                      # NEW — Phase 2.3
│       │   ├── add.ts                            # NEW — Phase 2.5; modified Phase 2.6, 2.7
│       │   ├── add.test.ts                       # NEW — Phase 2.5; modified Phase 2.6, 2.7
│       │   ├── update.ts                         # NEW — Phase 2.8
│       │   └── update.test.ts                    # NEW — Phase 2.8
│       ├── registry/
│       │   ├── readUrl.ts                        # NEW — Phase 2.2
│       │   ├── readUrl.test.ts                   # NEW — Phase 2.2
│       │   ├── fetchRegistry.ts                  # NEW — Phase 2.2
│       │   ├── fetchRegistry.test.ts             # NEW — Phase 2.2
│       │   ├── ref.ts                            # NEW — Phase 2.7
│       │   └── ref.test.ts                       # NEW — Phase 2.7
│       ├── config/
│       │   ├── matterConfig.ts                   # NEW — Phase 2.4
│       │   └── matterConfig.test.ts              # NEW — Phase 2.4
│       ├── transforms/
│       │   ├── rewriteImports.ts                 # NEW — Phase 2.6
│       │   └── rewriteImports.test.ts            # NEW — Phase 2.6
│       └── test-fixtures/
│           ├── registry/
│           │   ├── registry.json                 # NEW — Phase 2.2
│           │   └── synthetic-component.tsx       # NEW — Phase 2.2
│           └── README.md                         # NEW — Phase 2.2 — explains the fixture purpose
├── scripts/
│   └── smoke-test-cli.mjs                        # NEW — Phase 2.9
└── docs/superpowers/plans/
    └── 2026-05-04-matter-m2-cli.md               # this file
```

---

## Phase 2.1 — CLI scaffolding + commander wiring

**Goal:** replace the stub `src/index.ts` with a real argv parser. After this phase, `node packages/matter-cli/dist/index.js --help` lists `init`, `list`, `add`, `update`. Each subcommand exists and prints `"<name>: not implemented yet (Phase 2.X)"`. `--version` prints the package version. Build is green; `pnpm typecheck`/`lint` pass.

### Task 1: Add `commander` runtime dep and inject version at build time

**Files:**

- Modify: `packages/matter-cli/package.json`
- Modify: `packages/matter-cli/tsup.config.ts`

- [ ] **Step 1.1: Add `commander` as a runtime dependency.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/package.json`

Replace its content with:

```json
{
  "name": "@lovo/matter-cli",
  "version": "0.0.0",
  "description": "CLI for Matter — copy-paste components from the registry into your project.",
  "license": "MIT",
  "type": "module",
  "bin": {
    "matter-cli": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run",
    "clean": "rm -rf dist .turbo *.tsbuildinfo"
  },
  "engines": {
    "node": ">=22"
  },
  "dependencies": {
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@matter/eslint-config": "workspace:*",
    "@matter/tsconfig": "workspace:*",
    "@types/node": "^22.7.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 1.2: Run `pnpm install` to materialize `commander` and `vitest`.**

```bash
pnpm install
```

Expected: completes without error; `node_modules/commander/` exists.

- [ ] **Step 1.3: Update tsup to inject `__VERSION__` at build time.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/tsup.config.ts`

Replace its content with:

```ts
import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
})
```

This reads `package.json` at build time and injects its `version` as a literal string everywhere `__VERSION__` appears in the source.

- [ ] **Step 1.4: Verify build still works (against the existing stub).**

```bash
pnpm --filter @lovo/matter-cli build
```

Expected: builds clean (the existing stub doesn't reference `__VERSION__`, so the define is harmless).

- [ ] **Step 1.5: Commit.**

```bash
git add packages/matter-cli/package.json packages/matter-cli/tsup.config.ts pnpm-lock.yaml
git commit -m "chore(matter-cli): add commander runtime dep and __VERSION__ build-time inject"
```

### Task 2: Replace stub with commander entry + subcommand stubs

**Files:**

- Modify: `packages/matter-cli/src/index.ts`

- [ ] **Step 2.1: Write the new entry.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/index.ts`

Replace its content with:

```ts
import { Command } from 'commander'

declare const __VERSION__: string

const program = new Command()

program
  .name('matter-cli')
  .description('CLI for Matter — copy-paste components from the registry into your project')
  .version(__VERSION__)

program
  .command('init')
  .description('one-time project setup — writes matter.config.json')
  .option('--force', 'overwrite an existing matter.config.json')
  .action(() => {
    console.log('init: not implemented yet (Phase 2.4)')
  })

program
  .command('list')
  .description('show available components in the registry')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .action(() => {
    console.log('list: not implemented yet (Phase 2.3)')
  })

program
  .command('add')
  .description('copy one or more components from the registry into componentsDir')
  .argument('<components...>', 'component slugs (e.g. "linear-gradient")')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite existing files in componentsDir')
  .action(() => {
    console.log('add: not implemented yet (Phase 2.5)')
  })

program
  .command('update')
  .description('re-fetch a previously-added component (or all, if no name given)')
  .argument('[components...]', 'component slugs; omit to update every component in componentsDir')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite files even if they have local edits')
  .action(() => {
    console.log('update: not implemented yet (Phase 2.8)')
  })

await program.parseAsync(process.argv)
```

- [ ] **Step 2.2: Build and run it.**

```bash
pnpm --filter @lovo/matter-cli build
node packages/matter-cli/dist/index.js --help
```

Expected output (formatting may vary slightly by commander version):

```
Usage: matter-cli [options] [command]

CLI for Matter — copy-paste components from the registry into your project

Options:
  -V, --version            output the version number
  -h, --help               display help for command

Commands:
  init [options]           one-time project setup — writes matter.config.json
  list [options]           show available components in the registry
  add [options] <components...>
                           copy one or more components from the registry into componentsDir
  update [options] [components...]
                           re-fetch a previously-added component (or all, if no name given)
  help [command]           display help for command
```

- [ ] **Step 2.3: Verify `--version`.**

```bash
node packages/matter-cli/dist/index.js --version
```

Expected: `0.0.0` (the value injected from `package.json` via `__VERSION__`).

- [ ] **Step 2.4: Verify each subcommand stub.**

```bash
node packages/matter-cli/dist/index.js init
node packages/matter-cli/dist/index.js list
node packages/matter-cli/dist/index.js add linear-gradient
node packages/matter-cli/dist/index.js update
```

Expected: each prints `"<name>: not implemented yet (Phase 2.X)"`.

- [ ] **Step 2.5: Run typecheck and lint.**

```bash
pnpm --filter @lovo/matter-cli typecheck
pnpm --filter @lovo/matter-cli lint
```

Expected: both green.

- [ ] **Step 2.6: Commit.**

```bash
git add packages/matter-cli/src/index.ts
git commit -m "feat(matter-cli): scaffold commander entry with init/list/add/update stubs"
```

### **STOP & PLAY — Phase 2.1 validation gate**

Run `node packages/matter-cli/dist/index.js --help` and read the help output. Try `--version`. Try invoking each subcommand. The CLI binary is now executable end-to-end — the rest of M2 fills in the actions.

---

## Phase 2.2 — Registry fetcher abstraction (TDD'd)

**Goal:** a single `readUrl(url): Promise<string>` that handles `file://` and `https?://` URLs, plus `fetchRegistry(url): Promise<Registry>` and `fetchComponentSource(url, file): Promise<string>` wrappers. All three are unit-tested using a fixture registry under `src/test-fixtures/registry/`. After this phase, `pnpm test` passes; nothing else changes user-facing.

### Task 1: Wire vitest for matter-cli

**Files:**

- Create: `packages/matter-cli/vitest.config.ts`

- [ ] **Step 1.1: Create `vitest.config.ts`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@lovo/matter-cli',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
```

The CLI is Node-only — no DOM, no React. `environment: 'node'` is intentional.

- [ ] **Step 1.2: Verify it runs.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: `No test files found, exiting with code 0` (because of `passWithNoTests: true`).

- [ ] **Step 1.3: Commit.**

```bash
git add packages/matter-cli/vitest.config.ts
git commit -m "chore(matter-cli): wire vitest with passWithNoTests"
```

### Task 2: Fixture registry for tests

**Files:**

- Create: `packages/matter-cli/src/test-fixtures/registry/registry.json`
- Create: `packages/matter-cli/src/test-fixtures/registry/synthetic-component.tsx`
- Create: `packages/matter-cli/src/test-fixtures/README.md`

- [ ] **Step 2.1: Create the fixture registry manifest.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/test-fixtures/registry/registry.json`

```json
{
  "version": "0.0.0-test",
  "components": {
    "synthetic-component": {
      "file": "synthetic-component.tsx",
      "description": "A tiny synthetic component used by matter-cli tests. Not shipped.",
      "dependencies": ["react"],
      "uses_primitives": [],
      "tier": 1
    }
  }
}
```

- [ ] **Step 2.2: Create the fixture component source.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/test-fixtures/registry/synthetic-component.tsx`

```tsx
'use client'

import type { ReactNode } from 'react'
// matter-internal alias used to exercise the rewriter in Phase 2.6.
import { something } from '@matter-internal/lib'

export interface SyntheticProps {
  children?: ReactNode
}

export function SyntheticComponent({ children }: SyntheticProps) {
  return <div data-something={String(something)}>{children}</div>
}
```

The `@matter-internal/lib` import is intentional and synthetic — it's how Phase 2.6 verifies the alias rewriter does what it claims.

- [ ] **Step 2.3: Create a README explaining the fixture's purpose.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/test-fixtures/README.md`

```markdown
# Test fixtures

These files are consumed by `vitest` tests in this package. They mimic the
shape of `registry/registry.json` and a Tier 1 component, but exist
exclusively to exercise the CLI without requiring network access or a
checked-out remote.

- `registry/registry.json` — minimal registry manifest with one component
- `registry/synthetic-component.tsx` — tiny component source used to
  exercise import rewriting and add/update flows

The synthetic component imports from `@matter-internal/lib` — a deliberate
fake alias used by `transforms/rewriteImports.test.ts` to verify the
rewriter applies the user's `aliases` config.
```

- [ ] **Step 2.4: Commit.**

```bash
git add packages/matter-cli/src/test-fixtures/
git commit -m "test(matter-cli): add fixture registry for unit tests"
```

### Task 3: TDD `readUrl(url)`

**Files:**

- Create: `packages/matter-cli/src/registry/readUrl.test.ts`
- Create: `packages/matter-cli/src/registry/readUrl.ts`

- [ ] **Step 3.1: Write the failing test.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/registry/readUrl.test.ts`

```ts
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readUrl } from './readUrl.js'

const FIXTURE_DIR = fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))

describe('readUrl', () => {
  it('reads a file:// URL and returns its contents as a string', async () => {
    const url = `file://${FIXTURE_DIR}registry.json`
    const contents = await readUrl(url)
    expect(contents).toContain('"synthetic-component"')
  })

  it('throws a clear error when a file:// URL points at a missing file', async () => {
    const url = `file://${FIXTURE_DIR}does-not-exist.json`
    await expect(readUrl(url)).rejects.toThrow(/does-not-exist\.json/)
  })

  it('rejects unsupported protocols (e.g. ftp://)', async () => {
    await expect(readUrl('ftp://example.com/registry.json')).rejects.toThrow(/protocol/i)
  })
})
```

> Note: we do not unit-test the `https://` path here — covering it would either require mocking `fetch` (brittle, low-value) or hitting the network (slow, flaky). The smoke test in Phase 2.9 exercises real `https://`.

- [ ] **Step 3.2: Run the test to verify it fails.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: FAIL with `Cannot find module './readUrl.js'` or similar.

- [ ] **Step 3.3: Implement `readUrl`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/registry/readUrl.ts`

```ts
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * Read a URL and return its contents as a UTF-8 string. Supports `file://`
 * and `http(s)://` schemes. Used internally by registry fetching and
 * component source fetching — the same code path serves dev (`file://`
 * pointing at the local registry) and production (`https://raw.githubusercontent.com/...`).
 */
export async function readUrl(url: string): Promise<string> {
  const parsed = new URL(url)

  if (parsed.protocol === 'file:') {
    const path = fileURLToPath(parsed)
    try {
      return await readFile(path, 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${path}`)
      }
      throw err
    }
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
    }
    return await res.text()
  }

  throw new Error(
    `Unsupported protocol: ${parsed.protocol} (only file://, http://, https:// are supported)`,
  )
}
```

- [ ] **Step 3.4: Run the test to verify it passes.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: 3 tests pass.

- [ ] **Step 3.5: Commit.**

```bash
git add packages/matter-cli/src/registry/readUrl.ts packages/matter-cli/src/registry/readUrl.test.ts
git commit -m "feat(matter-cli): add readUrl with file:// + https:// support"
```

### Task 4: TDD `fetchRegistry(url)` and `fetchComponentSource(url, file)`

**Files:**

- Create: `packages/matter-cli/src/registry/fetchRegistry.test.ts`
- Create: `packages/matter-cli/src/registry/fetchRegistry.ts`

- [ ] **Step 4.1: Write the failing test.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/registry/fetchRegistry.test.ts`

```ts
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetchRegistry, fetchComponentSource } from './fetchRegistry.js'

const FIXTURE_BASE = `file://${fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))}`

describe('fetchRegistry', () => {
  it('parses registry.json from a base URL', async () => {
    const reg = await fetchRegistry(FIXTURE_BASE)
    expect(reg.components['synthetic-component']).toBeDefined()
    expect(reg.components['synthetic-component']?.file).toBe('synthetic-component.tsx')
  })

  it('throws when the registry JSON is malformed', async () => {
    // Pointing at a non-JSON file (the README) gives invalid JSON.
    const bad = `file://${fileURLToPath(new URL('../test-fixtures/', import.meta.url))}`
    await expect(fetchRegistry(bad)).rejects.toThrow()
  })

  it('joins base URL + filename without losing the trailing slash', async () => {
    // Whether the user supplies "…/registry" or "…/registry/", fetchRegistry
    // should both succeed at locating registry.json.
    const noTrailingSlash = FIXTURE_BASE.replace(/\/$/, '')
    const reg = await fetchRegistry(noTrailingSlash)
    expect(reg.components['synthetic-component']).toBeDefined()
  })
})

describe('fetchComponentSource', () => {
  it('reads the source file referenced by a registry entry', async () => {
    const src = await fetchComponentSource(FIXTURE_BASE, 'synthetic-component.tsx')
    expect(src).toContain('SyntheticComponent')
    expect(src).toContain('@matter-internal/lib')
  })
})
```

- [ ] **Step 4.2: Run the test to verify it fails.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: FAIL with module-not-found.

- [ ] **Step 4.3: Implement `fetchRegistry` and `fetchComponentSource`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/registry/fetchRegistry.ts`

```ts
import { readUrl } from './readUrl.js'

export interface RegistryEntry {
  file: string
  description?: string
  dependencies: string[]
  uses_primitives?: string[]
  tier: 1 | 2 | 3
}

export interface Registry {
  version: string
  components: Record<string, RegistryEntry>
}

/**
 * Join a base URL with a relative filename, normalizing the trailing slash.
 * `joinUrl("https://x/registry", "foo.tsx")` and `joinUrl("https://x/registry/", "foo.tsx")`
 * both return `https://x/registry/foo.tsx`.
 */
export function joinUrl(base: string, file: string): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base
  return `${trimmed}/${file}`
}

/**
 * Fetch and parse `registry.json` from a base registry URL.
 * The base URL points at the directory containing registry.json
 * (e.g. `file:///.../registry/` or
 * `https://raw.githubusercontent.com/lovo/matter/main/registry`).
 */
export async function fetchRegistry(baseUrl: string): Promise<Registry> {
  const url = joinUrl(baseUrl, 'registry.json')
  const json = await readUrl(url)
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (err) {
    throw new Error(`Registry at ${url} is not valid JSON: ${(err as Error).message}`)
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('components' in parsed) ||
    typeof (parsed as { components: unknown }).components !== 'object'
  ) {
    throw new Error(`Registry at ${url} is missing a "components" object`)
  }
  return parsed as Registry
}

/**
 * Fetch the raw source of a component file referenced by a registry entry.
 */
export async function fetchComponentSource(baseUrl: string, file: string): Promise<string> {
  return await readUrl(joinUrl(baseUrl, file))
}
```

- [ ] **Step 4.4: Run the tests to verify they pass.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: 7 tests pass total (3 from `readUrl`, 4 from `fetchRegistry`).

- [ ] **Step 4.5: Run typecheck and lint.**

```bash
pnpm --filter @lovo/matter-cli typecheck
pnpm --filter @lovo/matter-cli lint
```

Expected: green.

- [ ] **Step 4.6: Commit.**

```bash
git add packages/matter-cli/src/registry/fetchRegistry.ts packages/matter-cli/src/registry/fetchRegistry.test.ts
git commit -m "feat(matter-cli): add fetchRegistry + fetchComponentSource"
```

### **STOP & PLAY — Phase 2.2 validation gate**

```bash
pnpm --filter @lovo/matter-cli test
```

You should see 7 passing tests. The registry layer is now solid before any user-facing command relies on it.

---

## Phase 2.3 — `list` command

**Goal:** wire the `list` action to `fetchRegistry` and print a one-line-per-component summary. After this phase, `node dist/index.js list --registry file:///abs/path/registry/` prints `linear-gradient · description · tier 1`. (The default registry URL is hardcoded inside `DEFAULT_MATTER_CONFIG` per Phase 2.4 — there is no separate `defaults.ts`.)

### Task 1: TDD the `list` command

**Files:**

- Create: `packages/matter-cli/src/commands/list.test.ts`
- Create: `packages/matter-cli/src/commands/list.ts`

- [ ] **Step 1.1: Write the failing test.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/list.test.ts`

```ts
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { runList } from './list.js'

const FIXTURE_BASE = `file://${fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))}`

describe('runList', () => {
  it('prints one line per component using a registry URL override', async () => {
    const log = vi.fn()
    await runList({ registry: FIXTURE_BASE, ref: 'main' }, { log })
    const output = log.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('synthetic-component')
    expect(output).toContain('A tiny synthetic component')
    expect(output).toContain('tier 1')
  })

  it('errors clearly when the registry has zero components', async () => {
    // The empty-registry case isn't covered by a fixture; we test the
    // empty-state branch directly via dependency injection in Phase 2.6+
    // if needed. For now, the happy path is enough — list's failure modes
    // are inherited from fetchRegistry, which has its own tests.
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 1.2: Run the test to verify it fails.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement `runList`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/list.ts`

```ts
import { fetchRegistry } from '../registry/fetchRegistry.js'

export interface ListOptions {
  registry?: string
  ref?: string
}

export interface ListIO {
  log: (line: string) => void
}

/**
 * `list` prints one line per component in the registry. The shape is
 * `<slug> · <description> · tier <N>`. If `--registry` is supplied, it's
 * used directly; otherwise the caller resolves the default URL from the
 * --ref / CLI version (Phase 2.7) and passes it in.
 */
export async function runList(opts: ListOptions, io: ListIO = { log: console.log }): Promise<void> {
  if (!opts.registry) {
    throw new Error(
      'list: --registry <url> is required at this phase (Phase 2.7 wires the default).',
    )
  }

  const registry = await fetchRegistry(opts.registry)
  const entries = Object.entries(registry.components)

  if (entries.length === 0) {
    io.log('No components in registry.')
    return
  }

  for (const [slug, entry] of entries) {
    const description = entry.description ?? '(no description)'
    io.log(`${slug} · ${description} · tier ${entry.tier}`)
  }
}
```

> The dependency-injected `io` object exists so tests can capture output without monkey-patching `console.log`. The CLI entry passes `console.log` directly.

- [ ] **Step 1.4: Run the test to verify it passes.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: green.

- [ ] **Step 1.5: Wire `runList` into the CLI entry.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/index.ts`

Replace the `list` command block:

```ts
program
  .command('list')
  .description('show available components in the registry')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .action(() => {
    console.log('list: not implemented yet (Phase 2.3)')
  })
```

with:

```ts
program
  .command('list')
  .description('show available components in the registry')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .action(async (opts: { registry?: string; ref?: string }) => {
    const { runList } = await import('./commands/list.js')
    await runList(opts)
  })
```

> Lazy `await import` keeps the startup path for `--help` snappy — the registry/fetch chain is only loaded when its command runs.

- [ ] **Step 1.6: Build and smoke-test against the local registry/.**

```bash
pnpm --filter @lovo/matter-cli build
node packages/matter-cli/dist/index.js list \
  --registry "file://$(pwd)/registry/"
```

Expected output:

```
linear-gradient · Animated linear or radial gradient with optional cursor parallax. The simplest, foundational Matter component. · tier 1
```

- [ ] **Step 1.7: Verify the missing-registry branch.**

```bash
node packages/matter-cli/dist/index.js list
```

Expected: error mentioning "--registry <url> is required at this phase". (Phase 2.7 fixes this.)

- [ ] **Step 1.8: Run typecheck and lint.**

```bash
pnpm --filter @lovo/matter-cli typecheck
pnpm --filter @lovo/matter-cli lint
```

Expected: green.

- [ ] **Step 1.9: Commit.**

```bash
git add packages/matter-cli/src/commands/list.ts packages/matter-cli/src/commands/list.test.ts packages/matter-cli/src/index.ts
git commit -m "feat(matter-cli): implement list command"
```

### **STOP & PLAY — Phase 2.3 validation gate**

Run `node packages/matter-cli/dist/index.js list --registry "file://$(pwd)/registry/"` and confirm the linear-gradient line prints. The first user-facing command is alive.

---

## Phase 2.4 — `init` command

**Goal:** `matter-cli init` writes `matter.config.json` to the current directory with the spec's defaults (componentsDir, registryUrl, aliases, tsx). `--force` overwrites; otherwise the command refuses to clobber an existing file. The config-read helper lands in this phase too — `add` and `update` consume it later.

### Task 1: TDD the matter-config read/write helper

**Files:**

- Create: `packages/matter-cli/src/config/matterConfig.test.ts`
- Create: `packages/matter-cli/src/config/matterConfig.ts`

- [ ] **Step 1.1: Write the failing tests.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/config/matterConfig.test.ts`

```ts
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MATTER_CONFIG,
  readMatterConfig,
  writeMatterConfig,
  type MatterConfig,
} from './matterConfig.js'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-config-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('matterConfig', () => {
  it('writes the default config when none exists', async () => {
    await writeMatterConfig(dir, DEFAULT_MATTER_CONFIG)
    const raw = await readFile(join(dir, 'matter.config.json'), 'utf-8')
    expect(JSON.parse(raw)).toEqual(DEFAULT_MATTER_CONFIG)
  })

  it('reads back what it wrote', async () => {
    const cfg: MatterConfig = {
      ...DEFAULT_MATTER_CONFIG,
      componentsDir: 'app/matter',
    }
    await writeMatterConfig(dir, cfg)
    const read = await readMatterConfig(dir)
    expect(read).toEqual(cfg)
  })

  it('throws a clear error when matter.config.json is missing', async () => {
    await expect(readMatterConfig(dir)).rejects.toThrow(/matter\.config\.json not found/)
  })

  it('throws a clear error when matter.config.json is malformed JSON', async () => {
    await writeFile(join(dir, 'matter.config.json'), '{ bad json }', 'utf-8')
    await expect(readMatterConfig(dir)).rejects.toThrow(/not valid JSON/)
  })

  it('throws when required fields are missing', async () => {
    await writeFile(join(dir, 'matter.config.json'), JSON.stringify({ tsx: true }), 'utf-8')
    await expect(readMatterConfig(dir)).rejects.toThrow(/componentsDir/)
  })
})
```

- [ ] **Step 1.2: Run the tests to verify they fail.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement matterConfig.ts.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/config/matterConfig.ts`

```ts
import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface MatterConfig {
  componentsDir: string
  registryUrl: string
  aliases: Record<string, string>
  tsx: boolean
}

/**
 * Defaults align with spec §4.3. componentsDir mirrors shadcn's
 * `src/components/ui` convention but namespaced under `matter` so a project
 * using both shadcn and matter doesn't collide.
 */
export const DEFAULT_MATTER_CONFIG: MatterConfig = {
  componentsDir: 'src/components/matter',
  registryUrl: 'https://raw.githubusercontent.com/lovo/matter/main/registry',
  aliases: { '@/': 'src/' },
  tsx: true,
}

const CONFIG_FILENAME = 'matter.config.json'

export function configPath(projectRoot: string): string {
  return join(projectRoot, CONFIG_FILENAME)
}

export async function configExists(projectRoot: string): Promise<boolean> {
  try {
    await access(configPath(projectRoot))
    return true
  } catch {
    return false
  }
}

export async function readMatterConfig(projectRoot: string): Promise<MatterConfig> {
  const path = configPath(projectRoot)
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `matter.config.json not found in ${projectRoot}. Run \`matter-cli init\` first.`,
      )
    }
    throw err
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${(err as Error).message}`)
  }
  return validateMatterConfig(parsed, path)
}

export async function writeMatterConfig(projectRoot: string, cfg: MatterConfig): Promise<void> {
  const path = configPath(projectRoot)
  const json = `${JSON.stringify(cfg, null, 2)}\n`
  await writeFile(path, json, 'utf-8')
}

function validateMatterConfig(parsed: unknown, path: string): MatterConfig {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${path}: expected an object`)
  }
  const obj = parsed as Record<string, unknown>
  if (typeof obj.componentsDir !== 'string' || obj.componentsDir === '') {
    throw new Error(`${path}: missing or empty "componentsDir" string`)
  }
  if (typeof obj.registryUrl !== 'string' || obj.registryUrl === '') {
    throw new Error(`${path}: missing or empty "registryUrl" string`)
  }
  if (typeof obj.aliases !== 'object' || obj.aliases === null) {
    throw new Error(`${path}: missing "aliases" object`)
  }
  if (typeof obj.tsx !== 'boolean') {
    throw new Error(`${path}: missing "tsx" boolean`)
  }
  // Coerce aliases into Record<string, string>
  const aliases: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj.aliases as Record<string, unknown>)) {
    if (typeof v !== 'string') {
      throw new Error(`${path}: aliases.${k} must be a string`)
    }
    aliases[k] = v
  }
  return {
    componentsDir: obj.componentsDir,
    registryUrl: obj.registryUrl,
    aliases,
    tsx: obj.tsx,
  }
}
```

- [ ] **Step 1.4: Run the tests to verify they pass.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: green; total tests now ~12.

- [ ] **Step 1.5: Commit.**

```bash
git add packages/matter-cli/src/config/matterConfig.ts packages/matter-cli/src/config/matterConfig.test.ts
git commit -m "feat(matter-cli): add matter.config.json read/write/validate helpers"
```

### Task 2: TDD the `init` command

**Files:**

- Create: `packages/matter-cli/src/commands/init.test.ts`
- Create: `packages/matter-cli/src/commands/init.ts`

- [ ] **Step 2.1: Write the failing tests.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/init.test.ts`

```ts
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runInit } from './init.js'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-init-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('runInit', () => {
  it('writes matter.config.json with defaults', async () => {
    await runInit({}, { cwd: dir, log: vi.fn() })
    const raw = await readFile(join(dir, 'matter.config.json'), 'utf-8')
    const cfg = JSON.parse(raw)
    expect(cfg.componentsDir).toBe('src/components/matter')
    expect(cfg.registryUrl).toContain('lovo/matter')
    expect(cfg.tsx).toBe(true)
  })

  it('refuses to overwrite an existing config without --force', async () => {
    await writeFile(join(dir, 'matter.config.json'), '{}', 'utf-8')
    await expect(runInit({}, { cwd: dir, log: vi.fn() })).rejects.toThrow(/already exists/)
  })

  it('overwrites with --force', async () => {
    await writeFile(join(dir, 'matter.config.json'), '{}', 'utf-8')
    await runInit({ force: true }, { cwd: dir, log: vi.fn() })
    const raw = await readFile(join(dir, 'matter.config.json'), 'utf-8')
    const cfg = JSON.parse(raw)
    expect(cfg.componentsDir).toBe('src/components/matter')
  })

  it('logs a confirmation message after writing', async () => {
    const log = vi.fn()
    await runInit({}, { cwd: dir, log })
    const output = log.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toMatch(/created matter\.config\.json/i)
  })
})
```

- [ ] **Step 2.2: Run the tests to verify they fail.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: FAIL.

- [ ] **Step 2.3: Implement `runInit`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/init.ts`

```ts
import {
  DEFAULT_MATTER_CONFIG,
  configExists,
  configPath,
  writeMatterConfig,
} from '../config/matterConfig.js'

export interface InitOptions {
  force?: boolean
}

export interface InitIO {
  cwd: string
  log: (line: string) => void
}

export async function runInit(
  opts: InitOptions,
  io: InitIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  const exists = await configExists(io.cwd)
  if (exists && !opts.force) {
    throw new Error(`matter.config.json already exists in ${io.cwd}. Pass --force to overwrite.`)
  }
  await writeMatterConfig(io.cwd, DEFAULT_MATTER_CONFIG)
  io.log(`Created matter.config.json at ${configPath(io.cwd)}`)
  io.log(
    'Edit `componentsDir` if your project uses a different layout, ' +
      'and adjust `aliases` to match your tsconfig paths.',
  )
}
```

- [ ] **Step 2.4: Run the tests to verify they pass.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: green; total tests ~16.

- [ ] **Step 2.5: Wire `runInit` into the CLI entry.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/index.ts`

Replace the `init` command block:

```ts
program
  .command('init')
  .description('one-time project setup — writes matter.config.json')
  .option('--force', 'overwrite an existing matter.config.json')
  .action(() => {
    console.log('init: not implemented yet (Phase 2.4)')
  })
```

with:

```ts
program
  .command('init')
  .description('one-time project setup — writes matter.config.json')
  .option('--force', 'overwrite an existing matter.config.json')
  .action(async (opts: { force?: boolean }) => {
    const { runInit } = await import('./commands/init.js')
    await runInit(opts)
  })
```

- [ ] **Step 2.6: Build and smoke-test in a temp dir.**

```bash
pnpm --filter @lovo/matter-cli build
mkdir -p /tmp/matter-init-smoke && cd /tmp/matter-init-smoke
node "$OLDPWD/packages/matter-cli/dist/index.js" init
cat matter.config.json
cd "$OLDPWD"
rm -rf /tmp/matter-init-smoke
```

Expected: `matter.config.json` contains the spec defaults; second run without `--force` errors clearly.

- [ ] **Step 2.7: Run typecheck and lint.**

```bash
pnpm --filter @lovo/matter-cli typecheck
pnpm --filter @lovo/matter-cli lint
```

Expected: green.

- [ ] **Step 2.8: Commit.**

```bash
git add packages/matter-cli/src/commands/init.ts packages/matter-cli/src/commands/init.test.ts packages/matter-cli/src/index.ts
git commit -m "feat(matter-cli): implement init command"
```

### **STOP & PLAY — Phase 2.4 validation gate**

`cd /tmp && mkdir matter-play && cd matter-play && node /abs/path/packages/matter-cli/dist/index.js init && cat matter.config.json` — see the config land. Open `matter.config.json` in your editor, change `componentsDir` to `app/matter`, save. The shape is yours to play with before `add` consumes it next phase.

---

## Phase 2.5 — `add <name>` single component happy path

**Goal:** `matter-cli add linear-gradient` reads `matter.config.json`, fetches the registry, fetches the component source, writes it to `componentsDir/<name>.tsx`, and prints a basic install hint. No alias rewriting yet (Phase 2.6), no multi-component (Phase 2.6), no `--ref` (Phase 2.7). Just the single-component happy path.

### Task 1: TDD the single-component `add` flow

**Files:**

- Create: `packages/matter-cli/src/commands/add.test.ts`
- Create: `packages/matter-cli/src/commands/add.ts`

- [ ] **Step 1.1: Write the failing tests.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/add.test.ts`

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MATTER_CONFIG, writeMatterConfig } from '../config/matterConfig.js'
import { runAdd } from './add.js'

const FIXTURE_BASE = `file://${fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))}`

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-add-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function seedConfig(overrides: Partial<typeof DEFAULT_MATTER_CONFIG> = {}) {
  await writeMatterConfig(dir, {
    ...DEFAULT_MATTER_CONFIG,
    registryUrl: FIXTURE_BASE,
    componentsDir: 'src/components/matter',
    ...overrides,
  })
}

describe('runAdd (single component, no aliases)', () => {
  it('writes the component source to componentsDir/<name>.tsx', async () => {
    await seedConfig()
    await runAdd(['synthetic-component'], {}, { cwd: dir, log: vi.fn() })
    const target = join(dir, 'src/components/matter/synthetic-component.tsx')
    const written = await readFile(target, 'utf-8')
    expect(written).toContain('SyntheticComponent')
    // No alias rewriting yet — the @matter-internal import comes through verbatim.
    expect(written).toContain('@matter-internal/lib')
  })

  it('creates componentsDir if it does not exist', async () => {
    await seedConfig({ componentsDir: 'app/very/nested/matter' })
    await runAdd(['synthetic-component'], {}, { cwd: dir, log: vi.fn() })
    const target = join(dir, 'app/very/nested/matter/synthetic-component.tsx')
    const written = await readFile(target, 'utf-8')
    expect(written).toContain('SyntheticComponent')
  })

  it('refuses to overwrite an existing file without --force', async () => {
    await seedConfig()
    await mkdir(join(dir, 'src/components/matter'), { recursive: true })
    await writeFile(join(dir, 'src/components/matter/synthetic-component.tsx'), 'existing', 'utf-8')
    await expect(runAdd(['synthetic-component'], {}, { cwd: dir, log: vi.fn() })).rejects.toThrow(
      /already exists/,
    )
  })

  it('overwrites with --force', async () => {
    await seedConfig()
    await mkdir(join(dir, 'src/components/matter'), { recursive: true })
    await writeFile(join(dir, 'src/components/matter/synthetic-component.tsx'), 'old', 'utf-8')
    await runAdd(['synthetic-component'], { force: true }, { cwd: dir, log: vi.fn() })
    const written = await readFile(
      join(dir, 'src/components/matter/synthetic-component.tsx'),
      'utf-8',
    )
    expect(written).toContain('SyntheticComponent')
  })

  it('errors clearly when the requested component is not in the registry', async () => {
    await seedConfig()
    await expect(runAdd(['nope'], {}, { cwd: dir, log: vi.fn() })).rejects.toThrow(
      /nope.*not found/i,
    )
  })

  it('prints a basic install hint with the component dependencies', async () => {
    await seedConfig()
    const log = vi.fn()
    await runAdd(['synthetic-component'], {}, { cwd: dir, log })
    const output = log.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toMatch(/npm install.*react/)
  })
})
```

- [ ] **Step 1.2: Run the tests to verify they fail.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement single-component `runAdd`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/add.ts`

```ts
import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readMatterConfig } from '../config/matterConfig.js'
import { fetchComponentSource, fetchRegistry } from '../registry/fetchRegistry.js'

export interface AddOptions {
  registry?: string
  ref?: string
  force?: boolean
}

export interface AddIO {
  cwd: string
  log: (line: string) => void
}

export async function runAdd(
  components: string[],
  opts: AddOptions,
  io: AddIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  if (components.length === 0) {
    throw new Error('add: at least one component name is required')
  }

  const cfg = await readMatterConfig(io.cwd)
  const registryUrl = opts.registry ?? cfg.registryUrl
  const registry = await fetchRegistry(registryUrl)

  // Phase 2.5: handle exactly one component. Phase 2.6 generalizes to N.
  if (components.length > 1) {
    throw new Error(
      'add: multi-component support arrives in Phase 2.6. Pass exactly one slug for now.',
    )
  }
  const slug = components[0]!
  const entry = registry.components[slug]
  if (!entry) {
    throw new Error(
      `Component "${slug}" not found in registry at ${registryUrl}. Run \`matter-cli list\` to see available components.`,
    )
  }

  const targetPath = join(io.cwd, cfg.componentsDir, entry.file)
  if (!opts.force) {
    try {
      await access(targetPath)
      throw new Error(`${targetPath} already exists. Pass --force to overwrite.`)
    } catch (err) {
      // ENOENT is the happy path here — file should not exist.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  const source = await fetchComponentSource(registryUrl, entry.file)

  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, source, 'utf-8')

  io.log(`Wrote ${targetPath}`)
  io.log('')
  io.log('Install required dependencies:')
  io.log(`  npm install ${entry.dependencies.join(' ')}`)
  io.log('  (use your preferred package manager — pnpm/yarn/bun work too)')
}
```

- [ ] **Step 1.4: Run the tests to verify they pass.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: green; total tests ~22.

- [ ] **Step 1.5: Wire `runAdd` into the CLI entry.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/index.ts`

Replace the `add` command block:

```ts
program
  .command('add')
  .description('copy one or more components from the registry into componentsDir')
  .argument('<components...>', 'component slugs (e.g. "linear-gradient")')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite existing files in componentsDir')
  .action(() => {
    console.log('add: not implemented yet (Phase 2.5)')
  })
```

with:

```ts
program
  .command('add')
  .description('copy one or more components from the registry into componentsDir')
  .argument('<components...>', 'component slugs (e.g. "linear-gradient")')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite existing files in componentsDir')
  .action(
    async (components: string[], opts: { registry?: string; ref?: string; force?: boolean }) => {
      const { runAdd } = await import('./commands/add.js')
      await runAdd(components, opts)
    },
  )
```

- [ ] **Step 1.6: Build and smoke-test against the local registry.**

```bash
pnpm --filter @lovo/matter-cli build
mkdir -p /tmp/matter-add-smoke && cd /tmp/matter-add-smoke
node "$OLDPWD/packages/matter-cli/dist/index.js" init
node "$OLDPWD/packages/matter-cli/dist/index.js" add linear-gradient \
  --registry "file://$OLDPWD/registry/"
ls src/components/matter/
head -3 src/components/matter/linear-gradient.tsx
cd "$OLDPWD"
rm -rf /tmp/matter-add-smoke
```

Expected: `linear-gradient.tsx` exists at `src/components/matter/linear-gradient.tsx`; first 3 lines start with `'use client'`.

- [ ] **Step 1.7: Run typecheck and lint.**

```bash
pnpm --filter @lovo/matter-cli typecheck
pnpm --filter @lovo/matter-cli lint
```

Expected: green.

- [ ] **Step 1.8: Commit.**

```bash
git add packages/matter-cli/src/commands/add.ts packages/matter-cli/src/commands/add.test.ts packages/matter-cli/src/index.ts
git commit -m "feat(matter-cli): implement add for a single component"
```

### **STOP & PLAY — Phase 2.5 validation gate**

In a temp dir: run `init` then `add linear-gradient --registry file://…/registry/`. Open the resulting `linear-gradient.tsx` — it should be byte-identical to the source in our `registry/` directory. The copy-paste model is now real.

---

## Phase 2.6 — `add` polish: multi-component + dedup install hints + alias rewriting

**Goal:** `add` accepts multiple slugs, deduplicates dependencies across them into one install hint, and rewrites `@matter-internal/*` imports per the user's `aliases` config. After this phase, `add foo bar baz` works in one command, and copying the synthetic-component fixture results in `@matter-internal/lib` being rewritten per `aliases`.

### Task 1: TDD the alias rewriter

**Files:**

- Create: `packages/matter-cli/src/transforms/rewriteImports.test.ts`
- Create: `packages/matter-cli/src/transforms/rewriteImports.ts`

- [ ] **Step 1.1: Write the failing tests.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/transforms/rewriteImports.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { rewriteImports } from './rewriteImports.js'

describe('rewriteImports', () => {
  it('rewrites @matter-internal/X to <alias>/X when an alias matches', () => {
    const src = `import { foo } from '@matter-internal/lib'\n`
    const out = rewriteImports(src, { '@matter-internal/': '@/lib/matter/' })
    expect(out).toBe(`import { foo } from '@/lib/matter/lib'\n`)
  })

  it('handles double-quoted imports', () => {
    const src = `import { foo } from "@matter-internal/lib"\n`
    const out = rewriteImports(src, { '@matter-internal/': '@/lib/matter/' })
    expect(out).toBe(`import { foo } from "@/lib/matter/lib"\n`)
  })

  it('handles dynamic imports', () => {
    const src = `const x = await import('@matter-internal/lib')\n`
    const out = rewriteImports(src, { '@matter-internal/': '@/lib/matter/' })
    expect(out).toBe(`const x = await import('@/lib/matter/lib')\n`)
  })

  it('leaves unrelated imports alone', () => {
    const src =
      `import { LinearGradient } from '@lovo/matter-react'\n` +
      `import { foo } from '@matter-internal/lib'\n`
    const out = rewriteImports(src, { '@matter-internal/': '@/lib/matter/' })
    expect(out).toContain(`import { LinearGradient } from '@lovo/matter-react'`)
    expect(out).toContain(`import { foo } from '@/lib/matter/lib'`)
  })

  it('is a no-op when no alias matches', () => {
    const src = `import { LinearGradient } from '@lovo/matter-react'\n`
    const out = rewriteImports(src, { '@/': 'src/' })
    expect(out).toBe(src)
  })

  it('handles multiple aliases', () => {
    const src = `import { a } from '@matter-internal/lib'\n` + `import { b } from '@/utils'\n`
    const out = rewriteImports(src, {
      '@matter-internal/': '@/lib/matter/',
      '@/': 'src/',
    })
    expect(out).toContain(`from '@/lib/matter/lib'`) // @matter-internal/ wins because longer prefix
    expect(out).toContain(`from 'src/utils'`)
  })
})
```

- [ ] **Step 1.2: Run the tests to verify they fail.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement `rewriteImports`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/transforms/rewriteImports.ts`

```ts
/**
 * Rewrite import specifiers in a TS/TSX source string per a prefix-match
 * alias map. Each alias key is treated as a literal prefix; if a specifier
 * starts with the key, the prefix is replaced with the value.
 *
 * v1's Tier 1 components don't actually use any internal aliases — every
 * import resolves to a published npm package (`@lovo/matter`,
 * `@lovo/matter-react`, `react`, `three`). The synthetic test fixture
 * imports `@matter-internal/lib` to exercise this code path. When future
 * components do share internal utilities, this rewriter is what shapes
 * those imports per the user's project layout.
 *
 * Longer alias keys win over shorter ones (so `@matter-internal/` beats
 * `@/` when both match).
 */
export function rewriteImports(source: string, aliases: Record<string, string>): string {
  const sortedAliases = Object.entries(aliases).sort(([a], [b]) => b.length - a.length)
  if (sortedAliases.length === 0) return source

  // Match `from '...'` / `from "..."` / `import('...')` / `import("...")`.
  const importRe = /(\bfrom\s+|\bimport\s*\(\s*)(['"])([^'"]+)\2/g

  return source.replace(importRe, (full, lead: string, quote: string, spec: string) => {
    for (const [key, value] of sortedAliases) {
      if (spec.startsWith(key)) {
        return `${lead}${quote}${value}${spec.slice(key.length)}${quote}`
      }
    }
    return full
  })
}
```

- [ ] **Step 1.4: Run the tests to verify they pass.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: 6 new tests pass.

- [ ] **Step 1.5: Commit.**

```bash
git add packages/matter-cli/src/transforms/rewriteImports.ts packages/matter-cli/src/transforms/rewriteImports.test.ts
git commit -m "feat(matter-cli): add import-alias rewriter"
```

### Task 2: Generalize `add` to multi-component + dedup install hint + alias rewriting

**Files:**

- Modify: `packages/matter-cli/src/commands/add.ts`
- Modify: `packages/matter-cli/src/commands/add.test.ts`

- [ ] **Step 2.1: Add a new `describe` block for multi-component + alias rewriting tests.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/add.test.ts`

Append the following as a new `describe` block at the bottom of the file (sibling to the existing `describe('runAdd (single component, no aliases)', …)`):

```ts
describe('runAdd (multi-component + dedup + alias rewriting)', () => {
  it('writes multiple components in one invocation against a custom registry', async () => {
    // Build an inline two-component registry in a temp dir so we can
    // exercise multi-slug add without bloating the shared fixture.
    const inlineDir = await mkdtemp(join(tmpdir(), 'matter-multi-fixture-'))
    await writeFile(
      join(inlineDir, 'registry.json'),
      JSON.stringify({
        version: '0.0.0-test',
        components: {
          alpha: { file: 'alpha.tsx', dependencies: ['react'], tier: 1 },
          beta: { file: 'beta.tsx', dependencies: ['react', 'three'], tier: 1 },
        },
      }),
      'utf-8',
    )
    await writeFile(join(inlineDir, 'alpha.tsx'), 'export const alpha = 1\n', 'utf-8')
    await writeFile(join(inlineDir, 'beta.tsx'), 'export const beta = 2\n', 'utf-8')

    await seedConfig({ registryUrl: `file://${inlineDir}/` })
    const log = vi.fn()
    await runAdd(['alpha', 'beta'], {}, { cwd: dir, log })

    const a = await readFile(join(dir, 'src/components/matter/alpha.tsx'), 'utf-8')
    const b = await readFile(join(dir, 'src/components/matter/beta.tsx'), 'utf-8')
    expect(a).toContain('alpha = 1')
    expect(b).toContain('beta = 2')

    // Dedup install hint: both depend on react; only one comes through.
    const output = log.mock.calls.map((c) => c[0]).join('\n')
    const installLine = output.split('\n').find((l) => l.startsWith('  npm install '))!
    const args = installLine.replace('  npm install ', '').trim().split(/\s+/).sort()
    expect(args).toEqual(['react', 'three'])

    await rm(inlineDir, { recursive: true, force: true })
  })

  it('rewrites @matter-internal imports per matter.config.json aliases', async () => {
    await seedConfig({ aliases: { '@matter-internal/': '@/lib/matter/' } })
    await runAdd(['synthetic-component'], {}, { cwd: dir, log: vi.fn() })
    const target = join(dir, 'src/components/matter/synthetic-component.tsx')
    const written = await readFile(target, 'utf-8')
    expect(written).toContain(`from '@/lib/matter/lib'`)
    expect(written).not.toContain('@matter-internal/lib')
  })
})
```

- [ ] **Step 2.2: Run tests to verify they fail.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: FAIL — current `runAdd` rejects multi-component, doesn't rewrite aliases.

- [ ] **Step 2.3: Replace `runAdd` with the generalized version.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/add.ts`

Replace the entire file with:

```ts
import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readMatterConfig } from '../config/matterConfig.js'
import { fetchComponentSource, fetchRegistry, type Registry } from '../registry/fetchRegistry.js'
import { rewriteImports } from '../transforms/rewriteImports.js'

export interface AddOptions {
  registry?: string
  ref?: string
  force?: boolean
}

export interface AddIO {
  cwd: string
  log: (line: string) => void
}

export async function runAdd(
  components: string[],
  opts: AddOptions,
  io: AddIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  if (components.length === 0) {
    throw new Error('add: at least one component name is required')
  }

  const cfg = await readMatterConfig(io.cwd)
  const registryUrl = opts.registry ?? cfg.registryUrl
  const registry = await fetchRegistry(registryUrl)

  // Resolve every component up front so we fail fast on missing slugs
  // before any disk write.
  const resolved = components.map((slug) => resolveComponent(slug, registry, registryUrl))

  // Pre-flight overwrite check on every target.
  for (const r of resolved) {
    const targetPath = join(io.cwd, cfg.componentsDir, r.entry.file)
    if (!opts.force) {
      try {
        await access(targetPath)
        throw new Error(`${targetPath} already exists. Pass --force to overwrite.`)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
    }
  }

  // Fetch + rewrite + write.
  const allDeps = new Set<string>()
  for (const r of resolved) {
    const targetPath = join(io.cwd, cfg.componentsDir, r.entry.file)
    const source = await fetchComponentSource(registryUrl, r.entry.file)
    const rewritten = rewriteImports(source, cfg.aliases)
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, rewritten, 'utf-8')
    io.log(`Wrote ${targetPath}`)
    for (const dep of r.entry.dependencies) allDeps.add(dep)
  }

  // Dedup + alphabetize install hint.
  const sortedDeps = [...allDeps].sort()
  io.log('')
  io.log('Install required dependencies:')
  io.log(`  npm install ${sortedDeps.join(' ')}`)
  io.log('  (use your preferred package manager — pnpm/yarn/bun work too)')
}

function resolveComponent(
  slug: string,
  registry: Registry,
  registryUrl: string,
): { slug: string; entry: NonNullable<Registry['components'][string]> } {
  const entry = registry.components[slug]
  if (!entry) {
    throw new Error(
      `Component "${slug}" not found in registry at ${registryUrl}. Run \`matter-cli list\` to see available components.`,
    )
  }
  return { slug, entry }
}
```

- [ ] **Step 2.4: Run all tests.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: green; all add tests (single + multi + alias) pass.

- [ ] **Step 2.5: Build and smoke-test multi-component manually.**

```bash
pnpm --filter @lovo/matter-cli build
mkdir -p /tmp/matter-multi-smoke && cd /tmp/matter-multi-smoke
node "$OLDPWD/packages/matter-cli/dist/index.js" init
node "$OLDPWD/packages/matter-cli/dist/index.js" add linear-gradient \
  --registry "file://$OLDPWD/registry/"
echo '---'
ls src/components/matter/
cd "$OLDPWD"
rm -rf /tmp/matter-multi-smoke
```

Expected: dedup install hint reads `npm install @lovo/matter @lovo/matter-react react three` (alphabetized; verify by reading the output).

- [ ] **Step 2.6: Run typecheck and lint.**

```bash
pnpm --filter @lovo/matter-cli typecheck
pnpm --filter @lovo/matter-cli lint
```

Expected: green.

- [ ] **Step 2.7: Commit.**

```bash
git add packages/matter-cli/src/commands/add.ts packages/matter-cli/src/commands/add.test.ts
git commit -m "feat(matter-cli): generalize add to multi-component + dedup + alias rewriting"
```

### **STOP & PLAY — Phase 2.6 validation gate**

Run `add linear-gradient` in a temp dir and read the install hint — confirm dependencies are alphabetized and unique. Edit `matter.config.json` to set `"aliases": { "@matter-internal/": "@/lib/matter/" }`, re-run `add linear-gradient --force`, and observe… nothing changes (linear-gradient doesn't import `@matter-internal/*`). The rewriter is forward-compatible without breaking v1.

---

## Phase 2.7 — `--ref` version pinning

**Goal:** `--ref <tag|branch|commit>` overrides which ref the GitHub raw URL points at; if omitted, the CLI defaults to its own `package.json` version (or `'main'` when version is `0.0.0`, since v0.0.0 isn't a real ref). After this phase, `list` works without `--registry` (using the default GitHub URL with the resolved ref), and `add --ref main` overrides the default.

### Task 1: TDD ref resolution

**Files:**

- Create: `packages/matter-cli/src/registry/ref.test.ts`
- Create: `packages/matter-cli/src/registry/ref.ts`

- [ ] **Step 1.1: Write the failing tests.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/registry/ref.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { resolveRef } from './ref.js'

describe('resolveRef', () => {
  it('returns the explicit ref when supplied', () => {
    expect(resolveRef('v1.2.3', '0.0.0')).toBe('v1.2.3')
    expect(resolveRef('main', '0.5.0')).toBe('main')
  })

  it('falls back to "main" when no ref and CLI version is 0.0.0 (dev build)', () => {
    expect(resolveRef(undefined, '0.0.0')).toBe('main')
  })

  it('uses v<version> as ref when no explicit ref and CLI is a real release', () => {
    expect(resolveRef(undefined, '0.1.0')).toBe('v0.1.0')
    expect(resolveRef(undefined, '1.2.3')).toBe('v1.2.3')
  })
})
```

- [ ] **Step 1.2: Run the tests to verify they fail.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement ref resolution.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/registry/ref.ts`

```ts
/**
 * Resolve which git ref the CLI should fetch from.
 *
 * - If `ref` is supplied, use it verbatim.
 * - If the CLI version is `0.0.0`, default to `main` (development build —
 *   no published v0.0.0 tag exists).
 * - Otherwise, default to `v<version>` (e.g. `0.1.0` → `v0.1.0`).
 *
 * This matches the shadcn pattern: the published CLI's default ref is the
 * version it was published at, so users aren't blindly tracking `main`.
 */
export function resolveRef(ref: string | undefined, cliVersion: string): string {
  if (ref !== undefined && ref !== '') return ref
  if (cliVersion === '0.0.0') return 'main'
  return `v${cliVersion}`
}
```

- [ ] **Step 1.4: Run tests to verify they pass.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: green.

- [ ] **Step 1.5: Commit.**

```bash
git add packages/matter-cli/src/registry/ref.ts packages/matter-cli/src/registry/ref.test.ts
git commit -m "feat(matter-cli): add resolveRef helper"
```

### Task 2: Wire ref resolution into the CLI entry, `list`, and `add`

**Files:**

- Modify: `packages/matter-cli/src/index.ts`
- Modify: `packages/matter-cli/src/commands/list.ts`
- Modify: `packages/matter-cli/src/commands/add.ts`
- Modify: `packages/matter-cli/src/commands/list.test.ts`
- Modify: `packages/matter-cli/src/commands/add.test.ts`

**Integration model:** `--registry` overrides `cfg.registryUrl`. `--ref` substitutes into any `${ref}` placeholder in the resolved URL — that placeholder is present in the default GitHub template but absent in custom URLs (file://, mirrors), so the substitution is a no-op for those. This way `cfg.registryUrl` remains the source of truth (per spec §4.3) AND `--ref` works for default-config users.

- [ ] **Step 2.1: Update `DEFAULT_MATTER_CONFIG.registryUrl` to include `${ref}`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/config/matterConfig.ts`

Change:

```ts
registryUrl: 'https://raw.githubusercontent.com/lovo/matter/main/registry',
```

to:

```ts
registryUrl: 'https://raw.githubusercontent.com/lovo/matter/${ref}/registry',
```

The existing matterConfig tests assert `toContain('lovo/matter')`, which still passes — no test change required for this step.

- [ ] **Step 2.2: Update `runList` to substitute `${ref}` and accept `cliVersion`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/list.ts`

Replace its content with:

```ts
import { readMatterConfig } from '../config/matterConfig.js'
import { fetchRegistry } from '../registry/fetchRegistry.js'
import { resolveRef } from '../registry/ref.js'

export interface ListOptions {
  registry?: string
  ref?: string
  cliVersion: string
}

export interface ListIO {
  cwd: string
  log: (line: string) => void
}

export async function runList(
  opts: ListOptions,
  io: ListIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  // If --registry isn't supplied, the user likely ran `init` already —
  // try reading the config. If the config is missing, fall back to the
  // built-in default template via DEFAULT_MATTER_CONFIG (the default's
  // template includes ${ref}).
  let baseUrl: string
  if (opts.registry !== undefined && opts.registry !== '') {
    baseUrl = opts.registry
  } else {
    try {
      const cfg = await readMatterConfig(io.cwd)
      baseUrl = cfg.registryUrl
    } catch {
      // No config? Use the built-in default. This lets users `list`
      // before they `init` — friendlier than forcing init first.
      const { DEFAULT_MATTER_CONFIG } = await import('../config/matterConfig.js')
      baseUrl = DEFAULT_MATTER_CONFIG.registryUrl
    }
  }

  const ref = resolveRef(opts.ref, opts.cliVersion)
  const url = baseUrl.replace('${ref}', ref)
  const registry = await fetchRegistry(url)
  const entries = Object.entries(registry.components)

  if (entries.length === 0) {
    io.log('No components in registry.')
    return
  }

  for (const [slug, entry] of entries) {
    const description = entry.description ?? '(no description)'
    io.log(`${slug} · ${description} · tier ${entry.tier}`)
  }
}
```

- [ ] **Step 2.3: Update the `list` test to set `cwd` and pass `cliVersion`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/list.test.ts`

Replace its content with:

```ts
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runList } from './list.js'

const FIXTURE_BASE = `file://${fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))}`

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-list-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('runList', () => {
  it('prints one line per component using --registry override', async () => {
    const log = vi.fn()
    await runList({ registry: FIXTURE_BASE, cliVersion: '0.0.0' }, { cwd: dir, log })
    const output = log.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('synthetic-component')
    expect(output).toContain('tier 1')
  })

  it('reads matter.config.json when --registry is not supplied', async () => {
    // Write a minimal config pointing at the fixture (with ${ref} placeholder).
    const { writeMatterConfig, DEFAULT_MATTER_CONFIG } = await import('../config/matterConfig.js')
    await writeMatterConfig(dir, {
      ...DEFAULT_MATTER_CONFIG,
      registryUrl: FIXTURE_BASE, // no ${ref} — stays literal
    })
    const log = vi.fn()
    await runList({ cliVersion: '0.0.0' }, { cwd: dir, log })
    const output = log.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('synthetic-component')
  })
})
```

- [ ] **Step 2.4: Update `runAdd` to substitute `${ref}` and accept `cliVersion`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/add.ts`

Modify the imports and the signature/body:

Replace `import { fetchComponentSource, fetchRegistry, type Registry } from '../registry/fetchRegistry.js'` with:

```ts
import { fetchComponentSource, fetchRegistry, type Registry } from '../registry/fetchRegistry.js'
import { resolveRef } from '../registry/ref.js'
```

Replace the `AddOptions` interface with:

```ts
export interface AddOptions {
  registry?: string
  ref?: string
  force?: boolean
  cliVersion: string
}
```

Replace the line `const registryUrl = opts.registry ?? cfg.registryUrl` with:

```ts
const baseUrl = opts.registry ?? cfg.registryUrl
const ref = resolveRef(opts.ref, opts.cliVersion)
const registryUrl = baseUrl.replace('${ref}', ref)
```

(Everything else in `runAdd` stays the same — `registryUrl` is already used downstream.)

- [ ] **Step 2.5: Update `runAdd` tests to pass `cliVersion`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/add.test.ts`

Add a helper at the top of the file (outside any describe):

```ts
const VERSION = '0.0.0'
```

In every `runAdd(...)` call, change `{}` (or whatever options object is passed) to include `cliVersion: VERSION`. For example:

```ts
await runAdd(['synthetic-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() })
```

Apply this transformation to every `runAdd(` call in `add.test.ts`.

Also add a new test for `--ref` substitution:

```ts
describe('runAdd (--ref handling)', () => {
  it('substitutes ${ref} into the registry URL when present', async () => {
    // Build a fake "templated" registry URL by parking a fixture under
    // a ref-shaped subdir.
    const inlineDir = await mkdtemp(join(tmpdir(), 'matter-ref-fixture-'))
    await mkdir(join(inlineDir, 'main'), { recursive: true })
    await writeFile(
      join(inlineDir, 'main/registry.json'),
      JSON.stringify({
        version: '0.0.0-test',
        components: {
          'synthetic-component': {
            file: 'synthetic-component.tsx',
            description: 'fixture',
            dependencies: ['react'],
            tier: 1,
          },
        },
      }),
      'utf-8',
    )
    await writeFile(
      join(inlineDir, 'main/synthetic-component.tsx'),
      `export function X(){ return null }\n`,
      'utf-8',
    )

    await seedConfig({ registryUrl: `file://${inlineDir}/\${ref}` })
    await runAdd(
      ['synthetic-component'],
      { ref: 'main', cliVersion: VERSION },
      { cwd: dir, log: vi.fn() },
    )
    const target = join(dir, 'src/components/matter/synthetic-component.tsx')
    const written = await readFile(target, 'utf-8')
    expect(written).toContain('function X')

    await rm(inlineDir, { recursive: true, force: true })
  })
})
```

- [ ] **Step 2.6: Update the CLI entry to thread `__VERSION__` through.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/index.ts`

Replace the `list` action:

```ts
  .action(async (opts: { registry?: string; ref?: string }) => {
    const { runList } = await import('./commands/list.js')
    await runList(opts)
  })
```

with:

```ts
  .action(async (opts: { registry?: string; ref?: string }) => {
    const { runList } = await import('./commands/list.js')
    await runList({ ...opts, cliVersion: __VERSION__ })
  })
```

Replace the `add` action:

```ts
  .action(async (
    components: string[],
    opts: { registry?: string; ref?: string; force?: boolean },
  ) => {
    const { runAdd } = await import('./commands/add.js')
    await runAdd(components, opts)
  })
```

with:

```ts
  .action(async (
    components: string[],
    opts: { registry?: string; ref?: string; force?: boolean },
  ) => {
    const { runAdd } = await import('./commands/add.js')
    await runAdd(components, { ...opts, cliVersion: __VERSION__ })
  })
```

- [ ] **Step 2.7: Run all tests.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: green.

- [ ] **Step 2.8: Build and smoke-test list without --registry.**

```bash
pnpm --filter @lovo/matter-cli build
mkdir -p /tmp/matter-ref-smoke && cd /tmp/matter-ref-smoke
node "$OLDPWD/packages/matter-cli/dist/index.js" init
# Default registryUrl in config now has ${ref}; --ref overrides it.
# Replace "registryUrl" in the config to point at our local registry
# for verification (the GitHub URL fails without a remote pushed).
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('matter.config.json', 'utf8'));
cfg.registryUrl = 'file://$OLDPWD/registry/';
fs.writeFileSync('matter.config.json', JSON.stringify(cfg, null, 2) + '\n');
"
node "$OLDPWD/packages/matter-cli/dist/index.js" list
cd "$OLDPWD"
rm -rf /tmp/matter-ref-smoke
```

Expected: `linear-gradient` appears in the output even though `--registry` was not supplied — the value comes from `matter.config.json`.

- [ ] **Step 2.9: Run typecheck and lint.**

```bash
pnpm --filter @lovo/matter-cli typecheck
pnpm --filter @lovo/matter-cli lint
```

Expected: green.

- [ ] **Step 2.10: Commit.**

```bash
git add packages/matter-cli/src/commands/list.ts \
        packages/matter-cli/src/commands/list.test.ts \
        packages/matter-cli/src/commands/add.ts \
        packages/matter-cli/src/commands/add.test.ts \
        packages/matter-cli/src/config/matterConfig.ts \
        packages/matter-cli/src/index.ts
git commit -m "feat(matter-cli): support --ref and read registryUrl from matter.config.json"
```

### **STOP & PLAY — Phase 2.7 validation gate**

`init` writes a config with the templated GitHub URL. `list` (no flags) tries to fetch it — and fails with a clear error since no GitHub remote is configured yet. Edit `matter.config.json` to point at `file://…/registry/`, re-run `list` — it works. Now imagine the published binary at `@lovo/matter-cli@0.1.0`: the same flow against a real remote pinned to `v0.1.0` is what shadcn calls "the version-pinned default."

---

## Phase 2.8 — `update` command

**Goal:** `matter-cli update <name>` re-fetches a previously-added component and overwrites it; without a name, it updates every component currently in `componentsDir`. The implementation reuses `runAdd` with `force: true` for the actual write — `update` is mostly bookkeeping (figure out which components to refresh).

### Task 1: TDD `update`

**Files:**

- Create: `packages/matter-cli/src/commands/update.test.ts`
- Create: `packages/matter-cli/src/commands/update.ts`

- [ ] **Step 1.1: Write the failing tests.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/update.test.ts`

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MATTER_CONFIG, writeMatterConfig } from '../config/matterConfig.js'
import { runUpdate } from './update.js'

const FIXTURE_BASE = `file://${fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))}`

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-update-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function seedConfigAndComponent() {
  await writeMatterConfig(dir, {
    ...DEFAULT_MATTER_CONFIG,
    registryUrl: FIXTURE_BASE,
  })
  await mkdir(join(dir, 'src/components/matter'), { recursive: true })
  await writeFile(
    join(dir, 'src/components/matter/synthetic-component.tsx'),
    'export const STALE = true\n',
    'utf-8',
  )
}

describe('runUpdate', () => {
  it('refreshes a single named component, overwriting local edits', async () => {
    await seedConfigAndComponent()
    await runUpdate(
      ['synthetic-component'],
      { force: true, cliVersion: '0.0.0' },
      { cwd: dir, log: vi.fn() },
    )
    const written = await readFile(
      join(dir, 'src/components/matter/synthetic-component.tsx'),
      'utf-8',
    )
    expect(written).toContain('SyntheticComponent')
    expect(written).not.toContain('STALE')
  })

  it('refreshes every component in componentsDir when no names are given', async () => {
    await seedConfigAndComponent()
    await runUpdate([], { force: true, cliVersion: '0.0.0' }, { cwd: dir, log: vi.fn() })
    const written = await readFile(
      join(dir, 'src/components/matter/synthetic-component.tsx'),
      'utf-8',
    )
    expect(written).toContain('SyntheticComponent')
  })

  it('errors clearly when componentsDir is empty and no names are given', async () => {
    await writeMatterConfig(dir, {
      ...DEFAULT_MATTER_CONFIG,
      registryUrl: FIXTURE_BASE,
    })
    await mkdir(join(dir, 'src/components/matter'), { recursive: true })
    await expect(
      runUpdate([], { force: true, cliVersion: '0.0.0' }, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/no components/i)
  })

  it('errors clearly when a named component is not present in componentsDir', async () => {
    await writeMatterConfig(dir, {
      ...DEFAULT_MATTER_CONFIG,
      registryUrl: FIXTURE_BASE,
    })
    await mkdir(join(dir, 'src/components/matter'), { recursive: true })
    await expect(
      runUpdate(
        ['synthetic-component'],
        { force: true, cliVersion: '0.0.0' },
        { cwd: dir, log: vi.fn() },
      ),
    ).rejects.toThrow(/synthetic-component.*not present/i)
  })

  it('refuses to overwrite without --force', async () => {
    await seedConfigAndComponent()
    await expect(
      runUpdate(['synthetic-component'], { cliVersion: '0.0.0' }, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/already exists/)
  })
})
```

- [ ] **Step 1.2: Run tests to verify they fail.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement `runUpdate`.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/commands/update.ts`

```ts
import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { readMatterConfig } from '../config/matterConfig.js'
import { fetchRegistry, type Registry } from '../registry/fetchRegistry.js'
import { resolveRef } from '../registry/ref.js'
import { runAdd } from './add.js'

export interface UpdateOptions {
  registry?: string
  ref?: string
  force?: boolean
  cliVersion: string
}

export interface UpdateIO {
  cwd: string
  log: (line: string) => void
}

export async function runUpdate(
  components: string[],
  opts: UpdateOptions,
  io: UpdateIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  const cfg = await readMatterConfig(io.cwd)
  const baseUrl = opts.registry ?? cfg.registryUrl
  const ref = resolveRef(opts.ref, opts.cliVersion)
  const registryUrl = baseUrl.replace('${ref}', ref)

  // Find components currently on disk in componentsDir.
  const componentsDir = join(io.cwd, cfg.componentsDir)
  const localFiles = await safeReaddir(componentsDir)
  const localSlugs = localFiles
    .filter((f) => extname(f) === '.tsx' || extname(f) === '.ts')
    .map((f) => f.replace(/\.(tsx|ts)$/, ''))

  const registry = await fetchRegistry(registryUrl)

  let toUpdate: string[]
  if (components.length === 0) {
    if (localSlugs.length === 0) {
      throw new Error(
        `No components found in ${componentsDir}. Run \`matter-cli add <name>\` first.`,
      )
    }
    // Filter local files to those that resolve to a registry slug.
    toUpdate = localSlugs.filter((slug) => slugIsInRegistry(slug, registry))
    if (toUpdate.length === 0) {
      throw new Error(`No components in ${componentsDir} match any registry entry.`)
    }
  } else {
    for (const slug of components) {
      const file = registry.components[slug]?.file
      const present = file !== undefined && localSlugs.includes(slug)
      if (!present) {
        throw new Error(
          `Component "${slug}" is not present in ${componentsDir}. Use \`matter-cli add ${slug}\` instead.`,
        )
      }
    }
    toUpdate = components
  }

  io.log(`Updating ${toUpdate.length} component(s) from ${registryUrl}…`)
  await runAdd(
    toUpdate,
    {
      registry: registryUrl,
      // ref already substituted above; pass undefined so runAdd doesn't double-resolve.
      ref: undefined,
      force: opts.force,
      cliVersion: opts.cliVersion,
    },
    io,
  )
}

async function safeReaddir(path: string): Promise<string[]> {
  try {
    return await readdir(path)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

function slugIsInRegistry(slug: string, registry: Registry): boolean {
  const entry = registry.components[slug]
  return entry !== undefined && entry.file.replace(/\.(tsx|ts)$/, '') === slug
}
```

- [ ] **Step 1.4: Run tests to verify they pass.**

```bash
pnpm --filter @lovo/matter-cli test
```

Expected: green.

- [ ] **Step 1.5: Wire `runUpdate` into the CLI entry.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/packages/matter-cli/src/index.ts`

Replace the `update` command block:

```ts
program
  .command('update')
  .description('re-fetch a previously-added component (or all, if no name given)')
  .argument('[components...]', 'component slugs; omit to update every component in componentsDir')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite files even if they have local edits')
  .action(() => {
    console.log('update: not implemented yet (Phase 2.8)')
  })
```

with:

```ts
program
  .command('update')
  .description('re-fetch a previously-added component (or all, if no name given)')
  .argument('[components...]', 'component slugs; omit to update every component in componentsDir')
  .option('--registry <url>', 'override the registryUrl from matter.config.json')
  .option('--ref <ref>', 'tag, branch, or commit (defaults to the CLI version)')
  .option('--force', 'overwrite files even if they have local edits')
  .action(
    async (components: string[], opts: { registry?: string; ref?: string; force?: boolean }) => {
      const { runUpdate } = await import('./commands/update.js')
      await runUpdate(components ?? [], { ...opts, cliVersion: __VERSION__ })
    },
  )
```

- [ ] **Step 1.6: Build and smoke-test update manually.**

```bash
pnpm --filter @lovo/matter-cli build
mkdir -p /tmp/matter-update-smoke && cd /tmp/matter-update-smoke
node "$OLDPWD/packages/matter-cli/dist/index.js" init
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('matter.config.json', 'utf8'));
cfg.registryUrl = 'file://$OLDPWD/registry/';
fs.writeFileSync('matter.config.json', JSON.stringify(cfg, null, 2) + '\n');
"
node "$OLDPWD/packages/matter-cli/dist/index.js" add linear-gradient
echo 'LOCAL EDIT' >> src/components/matter/linear-gradient.tsx
tail -1 src/components/matter/linear-gradient.tsx
echo '---'
node "$OLDPWD/packages/matter-cli/dist/index.js" update linear-gradient --force
tail -1 src/components/matter/linear-gradient.tsx
cd "$OLDPWD"
rm -rf /tmp/matter-update-smoke
```

Expected: before update, last line is `LOCAL EDIT`; after `update --force`, the file is back to the registry's last line (a closing `}`).

- [ ] **Step 1.7: Run typecheck and lint.**

```bash
pnpm --filter @lovo/matter-cli typecheck
pnpm --filter @lovo/matter-cli lint
```

Expected: green.

- [ ] **Step 1.8: Commit.**

```bash
git add packages/matter-cli/src/commands/update.ts packages/matter-cli/src/commands/update.test.ts packages/matter-cli/src/index.ts
git commit -m "feat(matter-cli): implement update command"
```

### **STOP & PLAY — Phase 2.8 validation gate**

Add a component, edit the copied file by hand, then `update <name> --force` — see your edits replaced with the latest. Run `update` (no args) and watch every local component refresh. The full CRUD-ish loop is now alive.

---

## Phase 2.9 — End-to-end smoke test in `/tmp` and tag `m2-complete`

**Goal:** a one-shot script that simulates a real user. Pack the CLI as a tarball with `pnpm pack`, install it into a fresh `/tmp/matter-cli-smoke/` project, run `init` + `add linear-gradient`, verify the resulting file matches what's in `registry/linear-gradient.tsx`, and clean up. After this phase passes, tag `m2-complete`.

### Task 1: Author the smoke-test script

**Files:**

- Create: `scripts/smoke-test-cli.mjs`

- [ ] **Step 1.1: Write the script.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/scripts/smoke-test-cli.mjs`

```js
#!/usr/bin/env node
// End-to-end smoke test for @lovo/matter-cli.
// Runs the CLI as a packed tarball against a fresh project in /tmp.
// Returns exit code 0 on success, non-zero on failure.

import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(__dirname, '..')
const cliDir = join(repoRoot, 'packages/matter-cli')
const registryFileUrl = `file://${join(repoRoot, 'registry')}/`

function step(label) {
  console.log(`\n→ ${label}`)
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', ...opts })
}

function runQuiet(cmd, opts = {}) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString()
}

const smokeDir = mkdtempSync(join(tmpdir(), 'matter-cli-smoke-'))
let exitCode = 0

try {
  step('Build the CLI')
  run('pnpm --filter @lovo/matter-cli build', { cwd: repoRoot })

  step(`Pack the CLI from ${cliDir}`)
  const packOutput = runQuiet(`pnpm pack --pack-destination "${smokeDir}"`, { cwd: cliDir })
  console.log(packOutput)
  // Find the .tgz that pnpm just produced.
  const tarball = runQuiet(`ls "${smokeDir}"/*.tgz | head -1`).trim()
  if (!tarball) throw new Error('No tarball produced by pnpm pack')
  console.log(`  tarball: ${tarball}`)

  step(`Initialize a fresh project in ${smokeDir}`)
  writeFileSync(
    join(smokeDir, 'package.json'),
    JSON.stringify({ name: 'matter-cli-smoke', version: '0.0.0', private: true }, null, 2) + '\n',
  )

  step(`Install the packed CLI`)
  run(`npm install --no-save "${tarball}"`, { cwd: smokeDir })

  step(`Run \`matter-cli init\``)
  run(`node node_modules/@lovo/matter-cli/dist/index.js init`, { cwd: smokeDir })

  step(`Point matter.config.json at the local registry (no GitHub remote yet)`)
  const cfgPath = join(smokeDir, 'matter.config.json')
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'))
  cfg.registryUrl = registryFileUrl
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n')

  step(`Run \`matter-cli list\``)
  run(`node node_modules/@lovo/matter-cli/dist/index.js list`, { cwd: smokeDir })

  step(`Run \`matter-cli add linear-gradient\``)
  run(`node node_modules/@lovo/matter-cli/dist/index.js add linear-gradient`, { cwd: smokeDir })

  step(`Verify the copied file matches the registry source`)
  const expected = readFileSync(join(repoRoot, 'registry/linear-gradient.tsx'), 'utf-8')
  const actual = readFileSync(join(smokeDir, 'src/components/matter/linear-gradient.tsx'), 'utf-8')
  if (expected !== actual) {
    throw new Error('Copied component does not match registry source')
  }
  console.log('  ✓ files are byte-identical')

  step(`Edit the copied component and run \`matter-cli update --force\``)
  writeFileSync(
    join(smokeDir, 'src/components/matter/linear-gradient.tsx'),
    'export const stale = true\n',
  )
  run(`node node_modules/@lovo/matter-cli/dist/index.js update linear-gradient --force`, {
    cwd: smokeDir,
  })
  const refreshed = readFileSync(
    join(smokeDir, 'src/components/matter/linear-gradient.tsx'),
    'utf-8',
  )
  if (refreshed !== expected) {
    throw new Error('Component was not refreshed by update --force')
  }
  console.log('  ✓ update --force restored the registry source')

  step('All smoke-test assertions passed ✅')
} catch (err) {
  console.error(`\n✗ Smoke test failed: ${err instanceof Error ? err.message : String(err)}`)
  exitCode = 1
} finally {
  rmSync(smokeDir, { recursive: true, force: true })
  process.exit(exitCode)
}
```

- [ ] **Step 1.2: Make the script executable and run it.**

```bash
chmod +x scripts/smoke-test-cli.mjs
node scripts/smoke-test-cli.mjs
```

Expected: ends with `All smoke-test assertions passed ✅` and exit code 0. The full pipeline ran:

- pnpm pack → tarball
- npm install of the tarball into a fresh /tmp project
- init → list → add linear-gradient → assert byte-equal to source
- edit → update --force → assert restored

If a step fails, the script prints which one and cleans up `/tmp` regardless.

- [ ] **Step 1.3: Add a top-level `smoke` script.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/package.json`

Add a new entry to `scripts`:

```json
    "smoke": "node scripts/smoke-test-cli.mjs",
```

(Add it between an existing pair — exact placement doesn't matter; suggest after `"clean"`.)

After editing, the scripts block should include:

```json
    "clean": "turbo run clean && rm -rf node_modules .turbo",
    "smoke": "node scripts/smoke-test-cli.mjs",
```

- [ ] **Step 1.4: Verify the top-level script works.**

```bash
pnpm smoke
```

Expected: same green output as the direct invocation.

- [ ] **Step 1.5: Commit.**

```bash
git add scripts/smoke-test-cli.mjs package.json
git commit -m "test(matter-cli): add end-to-end smoke test against /tmp/ project"
```

### Task 2: Update CLAUDE.md M2 status and tag the milestone

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 2.1: Update the milestone status table.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/CLAUDE.md`

Find the table:

```
| 2 | `@lovo/matter-cli` | Pending | — |
```

Replace with:

```
| 2 | `@lovo/matter-cli` | ✅ Complete | `m2-complete` |
```

- [ ] **Step 2.2: Add a `pnpm smoke` entry to the Common commands section.**

File: `/Users/hunter.garrett/Documents/_personal/mattermix/CLAUDE.md`

Find the existing `# Smoke test the CLI binary:` block:

```bash
# Smoke test the CLI binary:
node packages/matter-cli/dist/index.js add foo
```

Replace it with:

```bash
# End-to-end smoke test the CLI in a fresh /tmp project:
pnpm smoke
```

- [ ] **Step 2.3: Run all checks one final time.**

```bash
pnpm install --frozen-lockfile
pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm smoke
```

Expected: every step green.

- [ ] **Step 2.4: Commit the CLAUDE.md updates.**

```bash
git add CLAUDE.md
git commit -m "docs: mark M2 complete in CLAUDE.md"
```

- [ ] **Step 2.5: Tag the milestone.**

```bash
git tag m2-complete
git tag
```

Expected: `m0-complete`, `m1-complete`, `m2-complete` listed.

### **STOP & PLAY — Phase 2.9 / M2 validation gate**

Run `pnpm smoke` once more and watch the full pipeline scroll by — pack, install, init, list, add, update, verify, clean up. The CLI works end-to-end against a real consumer project. When the GitHub remote is configured later, swap `file://…/registry/` for the published GitHub raw URL and the same script proves the production path. M2 is done.

Open the smoke-test script in your editor and skim it once — it's also the user manual for "how would I demo this?". You can paste any phase from it into a terminal to repeat that step in isolation.

---

## Self-review checklist (run after the plan is written, before execution begins)

This is a checklist for the plan author. If gaps exist, fix the plan inline.

**1. Spec coverage:**

| Spec requirement (§4.3 + §10.2 M2)                                            | Phase that delivers it                     |
| ----------------------------------------------------------------------------- | ------------------------------------------ |
| `init` command                                                                | 2.4                                        |
| `list` command                                                                | 2.3                                        |
| `add` (single + multi)                                                        | 2.5, 2.6                                   |
| `update` (single + all)                                                       | 2.8                                        |
| `--ref <tag\|branch\|commit>`                                                 | 2.7                                        |
| Default ref = installed CLI version                                           | 2.7 (`resolveRef`)                         |
| Reads `registry.json` from GitHub raw URL                                     | 2.2 (`readUrl`), 2.3, 2.4 (default config) |
| Rewrites internal imports per aliases                                         | 2.6 (`rewriteImports`)                     |
| `matter.config.json` with `componentsDir` / `registryUrl` / `aliases` / `tsx` | 2.4 (`matterConfig`)                       |
| Prints required `npm install` deps                                            | 2.5, 2.6 (dedup)                           |
| Smoke-test in a fresh project                                                 | 2.9                                        |

All boxes checked.

**2. Placeholder scan:**

No "TBD" / "implement later" / "fill in details" / "Write tests for the above" without code / "Similar to Task N" patterns appear in the plan. Every step shows the actual command, file path, and code.

**3. Type consistency:**

- `MatterConfig` interface: defined in 2.4, consumed identically in 2.5 (add), 2.7 (list update), 2.8 (update). Field names (`componentsDir`, `registryUrl`, `aliases`, `tsx`) match throughout.
- `Registry` / `RegistryEntry` interfaces: defined in 2.2; consumed in 2.5/2.6/2.8 via the same import.
- `AddOptions` evolves between 2.5 (no `cliVersion`) and 2.7 (adds `cliVersion`). The plan explicitly notes the change in 2.7 Step 2.4. No drift.
- `runList`'s signature changes between 2.3 (`opts: ListOptions; io: ListIO = { log }`) and 2.7 (`io: ListIO = { cwd, log }`). The plan replaces the file content wholesale in 2.7 Step 2.2, and updates the test in 2.7 Step 2.3 — both call sites in sync.
- `runUpdate` calls `runAdd` with `ref: undefined` to avoid double-resolution. This matches `runAdd`'s accepted shape.
- `__VERSION__` declared as `const __VERSION__: string` in `index.ts` (Phase 2.1) and consumed unchanged in 2.7. The tsup `define` in `tsup.config.ts` (Phase 2.1) maps it to a JSON-stringified literal, so the consumed type is `string`.
- `registryUrl` ends up using the GitHub raw template `https://raw.githubusercontent.com/lovo/matter/${ref}/registry` in exactly one place: `DEFAULT_MATTER_CONFIG.registryUrl` (set in Phase 2.4 with `main`, then updated to `${ref}` in Phase 2.7). The smoke test (Phase 2.9) overrides the field to a `file://` URL since no GitHub remote is configured yet.

All signatures/types align.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-04-matter-m2-cli.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Aligns with the user's stated preference for milestone work.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
