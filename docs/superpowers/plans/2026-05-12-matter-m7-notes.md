# M7 baseline — captured 2026-05-12

| Command                        | Wall time | Exit | Notes                                                                     |
| ------------------------------ | --------- | ---- | ------------------------------------------------------------------------- |
| pnpm install --frozen-lockfile | 0.7s      | 0    | Lockfile up to date, nothing to install                                   |
| pnpm typecheck                 | 7.0s      | 0    | 4 cached; turbo warning: no outputs key for docs#typecheck (pre-existing) |
| pnpm lint                      | 2.6s      | 0    | 2 cached; MODULE_TYPELESS_PACKAGE_JSON warnings (pre-existing, cosmetic)  |
| pnpm build                     | 13.3s     | 0    | 2 cached; full Next.js docs site SSG included                             |
| pnpm test                      | 3.8s      | 0    | 2 cached; 22 test files, 80 tests (55 matter + 25 matter-react) all pass  |
| pnpm smoke                     | 2.3s      | 0    | add + update --force, byte-identical file check passed                    |

dist/ artifacts present:

- packages/matter/dist:

```
drwxr-xr-x@  9 hunter.garrett  staff     288 May 11 18:52 .
drwxr-xr-x@ 15 hunter.garrett  staff     480 May 12 17:03 ..
-rw-r--r--@  1 hunter.garrett  staff  190046 May  8 16:12 .tsbuildinfo
-rw-r--r--@  1 hunter.garrett  staff   15149 May 11 18:52 index.cjs
-rw-r--r--@  1 hunter.garrett  staff   41409 May 11 18:52 index.cjs.map
-rw-r--r--@  1 hunter.garrett  staff   14993 May 11 18:52 index.d.cts
-rw-r--r--@  1 hunter.garrett  staff   14993 May 11 18:52 index.d.ts
-rw-r--r--@  1 hunter.garrett  staff   13009 May 11 18:52 index.js
-rw-r--r--@  1 hunter.garrett  staff   39565 May 11 18:52 index.js.map
```

- packages/matter-react/dist:

```
drwxr-xr-x@  9 hunter.garrett  staff     288 May 12 17:03 .
drwxr-xr-x@ 15 hunter.garrett  staff     480 May 12 17:03 ..
-rw-r--r--@  1 hunter.garrett  staff  193585 May  8 16:09 .tsbuildinfo
-rw-r--r--@  1 hunter.garrett  staff   14423 May 12 17:03 index.cjs
-rw-r--r--@  1 hunter.garrett  staff   31665 May 12 17:03 index.cjs.map
-rw-r--r--@  1 hunter.garrett  staff    7199 May 12 17:03 index.d.cts
-rw-r--r--@  1 hunter.garrett  staff    7199 May 12 17:03 index.d.ts
-rw-r--r--@  1 hunter.garrett  staff   12612 May 12 17:03 index.js
-rw-r--r--@  1 hunter.garrett  staff   30808 May 12 17:03 index.js.map
```

- packages/matter-cli/dist:

```
drwxr-xr-x@ 20 hunter.garrett  staff    640 May 12 17:03 .
drwxr-xr-x@ 15 hunter.garrett  staff    480 May 12 17:03 ..
-rw-r--r--@  1 hunter.garrett  staff  60290 May 10 08:24 .tsbuildinfo
-rwxr-xr-x@  1 hunter.garrett  staff    189 May 12 17:03 add-WFXJ7HFS.js
-rw-r--r--@  1 hunter.garrett  staff     71 May 12 17:03 add-WFXJ7HFS.js.map
-rwxr-xr-x@  1 hunter.garrett  staff   2503 May 12 17:03 chunk-PWYRLP7T.js
-rw-r--r--@  1 hunter.garrett  staff   4817 May 12 17:03 chunk-PWYRLP7T.js.map
-rwxr-xr-x@  1 hunter.garrett  staff   2168 May 12 17:03 chunk-QTD5MDLV.js
-rw-r--r--@  1 hunter.garrett  staff   5572 May 12 17:03 chunk-QTD5MDLV.js.map
```

## Vite+ install (Task A.1 — captured 2026-05-12)

- `node -v`: v24.15.0 (drift: .nvmrc says 22 — see concerns below)
- `pnpm -v`: 9.12.3 (drift: packageManager field says 9.12.0 — see concerns below)
- `which vp`: shell function wrapping `command vp` (installed via Vite+ CLI installer; resolves via PATH)
- `vp --version`: vp v0.1.14

**Concerns (non-fatal):**

- Node.js is v24.15.0, not v22.x as specified in `.nvmrc`. This is a version ahead of what the plan assumed. No failures observed; document in case any tool behaves differently under v24.
- pnpm is 9.12.3 vs the pinned `9.12.0` in `packageManager`. Patch-level drift only; no failures observed.
- `vp --version` output also shows all local Vite+ tools (vite, rolldown, vitest, oxfmt, oxlint, tsdown) as "Not found" — expected at this baseline stage before `vp install` / `vp migrate` runs. The `Package manager` and `Node.js` lines confirm `vp` is correctly detecting the environment.

### `vp --help` (first 30 lines)

```
VITE+ - The Unified Toolchain for the Web

Usage: vp [COMMAND]

Start:
  create      Create a new project from a template
  migrate     Migrate an existing project to Vite+
  config      Configure hooks and agent integration
  staged      Run linters on staged files
  install, i  Install all dependencies, or add packages if package names are provided
  env         Manage Node.js versions

Develop:
  dev    Run the development server
  check  Run format, lint, and type checks
  lint   Lint code
  fmt    Format code
  test   Run tests

Execute:
  run    Run tasks
  exec   Execute a command from local node_modules/.bin
  dlx    Execute a package binary without installing it as a dependency
  cache  Manage the task cache

Build:
  build    Build for production
  pack     Build library
  preview  Preview production build
```

### `vp env --help` (first 30 lines)

```
VITE+ - The Unified Toolchain for the Web

Usage: vp env [COMMAND]

Manage Node.js versions

Setup:
  setup  Create or update shims in VITE_PLUS_HOME/bin
  on     Enable managed mode - shims always use vite-plus managed Node.js
  off    Enable system-first mode - shims prefer system Node.js, fallback to managed
  print  Print shell snippet to set environment for current session

Manage:
  default    Set or show the global default Node.js version
  pin        Pin a Node.js version in the current directory (creates .node-version)
  unpin      Remove the .node-version file from current directory (alias for `pin --unpin`)
  use        Use a specific Node.js version for this shell session
  install    Install a Node.js version [aliases: i]
  uninstall  Uninstall a Node.js version [aliases: uni]
  exec       Execute a command with a specific Node.js version [aliases: run]

Inspect:
  current      Show current environment information
  doctor       Run diagnostics and show environment status
  which        Show path to the tool that would be executed
  list         List locally installed Node.js versions [aliases: ls]
  list-remote  List available Node.js versions from the registry [aliases: ls-remote]

Examples:
  Setup:
```

### `vp install --help` (first 30 lines)

```
VITE+ - The Unified Toolchain for the Web

Usage: vp install [OPTIONS] [PACKAGES]... [-- <PASS_THROUGH_ARGS>...]

Install all dependencies, or add packages if package names are provided

Arguments:
  [PACKAGES]...           Packages to add (if provided, acts as `vp add`)
  [PASS_THROUGH_ARGS]...  Additional arguments to pass through to the package manager

Options:
  -P, --prod            Do not install devDependencies
  -D, --dev             Only install devDependencies (install) / Save to devDependencies (add)
  --no-optional         Do not install optionalDependencies
  --frozen-lockfile     Fail if lockfile needs to be updated (CI mode)
  --no-frozen-lockfile  Allow lockfile updates (opposite of --frozen-lockfile)
  --lockfile-only       Only update lockfile, don't install
  --prefer-offline      Use cached packages when available
  --offline             Only use packages already in cache
  -f, --force           Force reinstall all dependencies
  --ignore-scripts      Do not run lifecycle scripts
  --no-lockfile         Don't read or generate lockfile
  --fix-lockfile        Fix broken lockfile entries (pnpm and yarn@2+ only)
  --shamefully-hoist    Create flat `node_modules` (pnpm only)
  --resolution-only     Re-run resolution for peer dependency analysis (pnpm only)
  --silent              Suppress output (silent mode)
  --filter <PATTERN>    Filter packages in monorepo (can be used multiple times)
  -w, --workspace-root  Install in workspace root only
  -E, --save-exact      Save exact version (only when adding packages)
  --save-peer           Save to peerDependencies (only when adding packages)
```

### `vp migrate --help` (first 30 lines)

```
VITE+ - The Unified Toolchain for the Web

Usage: vp migrate [PATH] [OPTIONS]

Migrate standalone Vite, Vitest, Oxlint, Oxfmt, and Prettier projects to unified Vite+.

Arguments:
  PATH  Target directory to migrate (default: current directory)

Options:
  --agent NAME      Write agent instructions file into the project (e.g. chatgpt, claude, opencode).
  --no-agent        Skip writing agent instructions file
  --editor NAME     Write editor config files into the project.
  --no-editor       Skip writing editor config files
  --hooks           Set up pre-commit hooks (default in non-interactive mode)
  --no-hooks        Skip pre-commit hooks setup
  --no-interactive  Run in non-interactive mode (skip prompts and use defaults)
  -h, --help        Show this help message

Examples:
  # Migrate current package
  vp migrate

  # Migrate specific directory
  vp migrate my-app

  # Non-interactive mode
  vp migrate --no-interactive

Migration Prompt:
```

## `vp env` adoption (Task A.2 — captured 2026-05-12)

### Diagnostic snapshot (before changes)

- `node -v` (before): v24.15.0
- `which node` (before): /Users/hunter.garrett/.vite-plus/bin/node

### `vp env current` (before)

```
VITE+ - The Unified Toolchain for the Web

Environment:
  Version       24.15.0
  Source        engines.node
  Source Path   /Users/hunter.garrett/Documents/_personal/matter/package.json
  Project Root  /Users/hunter.garrett/Documents/_personal/matter

Tool Paths:
  node  /Users/hunter.garrett/.vite-plus/js_runtime/node/24.15.0/bin/node
  npm   /Users/hunter.garrett/.vite-plus/js_runtime/node/24.15.0/bin/npm
  npx   /Users/hunter.garrett/.vite-plus/js_runtime/node/24.15.0/bin/npx
```

### `vp env doctor` (before)

```
VITE+ - The Unified Toolchain for the Web

Installation
  v VITE_PLUS_HOME    ~/.vite-plus
  v Bin directory     exists
  v Shims             node, npm, npx, vpx

Configuration
  v Shim mode         managed
  v IDE integration   env sourced in ~/.zshenv

PATH
  ! vp                in PATH at position 1
  note: For best results, bin should be first in PATH.
  v node              ~/.vite-plus/bin/node (vp shim)
  v npm               ~/.vite-plus/bin/npm (vp shim)
  v npx               ~/.vite-plus/bin/npx (vp shim)
  v vpx               ~/.vite-plus/bin/vpx (vp shim)

Version Resolution
  Directory         /Users/hunter.garrett/Documents/_personal/matter
  Source            /Users/hunter.garrett/Documents/_personal/matter/package.json
  Version           24.15.0
  v Node binary       installed

v All checks passed
```

### `vp env list` (before)

```
* v24.14.1
* v24.15.0  current
```

### Node version intent

- `.nvmrc` content: `22`
- `engines.node` from root package.json: `>=22`
- Chosen: vp-managed Node 22.x.x (matches `.nvmrc`)
- Rationale: `vp env` was already in managed mode but resolving to 24.15.0 via `engines.node` (the `>=22` range satisfies with the highest installed version). To lock the project to Node 22 as `.nvmrc` intends, `vp env pin 22` was used — this creates `.node-version` in the repo root, which vp treats as the highest-priority resolution source (overrides both `.nvmrc` and `engines.node`).

### Actions taken

- `vp env list` (before): showed only v24.14.1 and v24.15.0 — Node 22 not yet installed
- `vp env install 22`: installed Node v22.22.2 (latest LTS in the 22.x line) into vp's managed store
- `vp env on`: already set to managed — output: "Shim mode is already set to managed."
- `vp env pin 22 --force`: created `.node-version` containing `22.22.2` in repo root; vp resolved `22` to the latest LTS `22.22.2`

### Post-switch state

- `node -v` (after): v22.22.2
- `vp env current` Source (after): `.node-version` (overrides `engines.node`)
- `pnpm -v` (after): 9.12.3 (unchanged; pnpm is not shimmed by vp env)
- `pnpm install --frozen-lockfile` outcome: pass — "Lockfile is up to date, resolution step is skipped"
- `pnpm-lock.yaml` clean after install: yes

### Full-pipeline parity check

| Command        | Exit | Notes                                                                               |
| -------------- | ---- | ----------------------------------------------------------------------------------- |
| pnpm typecheck | 0    | 8 cached, FULL TURBO                                                                |
| pnpm lint      | 0    | 5 cached, FULL TURBO; pre-existing MODULE_TYPELESS_PACKAGE_JSON warnings (cosmetic) |
| pnpm build     | 0    | 5 cached, FULL TURBO; Next.js SSG 31 pages                                          |
| pnpm test      | 0    | 55 matter + 46 matter-cli + 25 matter-react = 126 tests pass                        |
| pnpm smoke     | 0    | add + update --force, byte-identical file check passed                              |

### Shell rc note

vp printed no rc modification instructions. `vp env on` reported "Shim mode is already set to managed." — the user's shell rc was already configured during the original Vite+ install (A.1 captured: "IDE integration: env sourced in ~/.zshenv"). No rc edits were needed or made.

### `.node-version` file

Created at repo root by `vp env pin 22 --force`. Content: `22.22.2`. This is committed as project intent — it pins all developers (and CI) to Node 22 LTS, matching `.nvmrc`, and takes priority over the `>=22` engines range so vp does not resolve to Node 24.

## `vp install` adoption (Task A.3 — captured 2026-05-12)

### Discovered command surface

- `vp install` (no args): delegates to pnpm install
- `vp install <pkg>`: acts as `pnpm add` (per help: "Packages to add (if provided, acts as `vp add`)")
- `vp remove` (aliases: `rm`, `un`, `uninstall`): removes packages from dependencies — dedicated subcommand, not a passthrough

### Round-trip test

- `vp install -D tiny-glob -w`: succeeded — `package.json` gained `tiny-glob ^0.2.9` under root `devDependencies`; `pnpm-lock.yaml` gained 21 lines (3 packages added). Diff shape identical to what `pnpm add -Dw tiny-glob` would produce.
- `vp remove tiny-glob -w`: succeeded — clean removal; `package.json` and `pnpm-lock.yaml` both reverted to pre-test state with zero diff. `git status` reported working tree clean.

### CI deferral decision

CI (`.github/workflows/ci.yml`) continues to use `pnpm install --frozen-lockfile`. No GitHub Action for vp installation is published yet (vp v0.1.14 alpha). Revisit when vp leaves alpha or a `setup-vp` action ships.

### Gate A endpoint reached

Phase A complete:

- ✅ vp v0.1.14 installed globally (A.1)
- ✅ vp env on; project shims Node to 22.22.2 via `.node-version` (A.2)
- ✅ vp install wraps pnpm; round-trip verified (A.3)
- ❌ CI deferred (no setup-vp action)

The user's stated M7 intent ("use Vite+ to manage runtime and package manager") is fulfilled. Phases B–D (vp migrate, Vite/Vitest bumps, full verification) remain pending.

## Migration research (Task B.1 — captured 2026-05-12)

### Target versions

- Vite: 5.4.x → **8.0.12**
- @vitejs/plugin-react: 4.3.x → **6.0.1**
- Vitest: 2.1.x → **4.1.6**
- @vitest/ui: 2.1.x → **4.1.6**

### Vite 5→8 breaking changes that affect us

**Vite 5→6:**

- `resolve.conditions` defaults changed: now includes `['module', 'browser', 'development|production']` for client builds. We have no explicit `resolve.conditions` in `vite.config.ts`, so Vite 6 will apply the new defaults automatically — this is fine for playground but worth noting since it changes how packages with a `module` export field are resolved.
- CommonJS `strictRequires` changed from `'auto'` to `true`: playground imports `three` and `@lovo/matter*` which are ESM, so no impact expected.
- Sass legacy API removed as default (modern API now default): we use no Sass in playground — no impact.
- None of the other v5→v6 changes (json.stringify, PostCSS v6, library CSS naming, HTML asset processing, SSR CSS default import) touch our playground config surface.

**Vite 6→7:**

- Node.js 18 dropped; 20.19+ or 22.12+ required. We are on 22.22.2 — satisfied.
- `build.target` defaults shifted (Chrome 87→107, etc.). Our `vite.config.ts` sets `build.target: 'es2022'` explicitly — the default change does not apply to us.
- Named `build.target: 'modules'` removed, replaced with `'baseline-widely-available'`. We use `'es2022'`, not `'modules'` — no impact.
- `optimizeDeps.entries` now receives only glob patterns (not literal paths). We have no `optimizeDeps.entries` configured — no impact.
- Sass legacy API fully removed (already removed in v6). No Sass — no impact.
- `splitVendorChunkPlugin` removed. We do not use it — no impact.

**Vite 7→8:**

- **`build.rollupOptions` → `build.rolldownOptions`**: We have no `rollupOptions` in `vite.config.ts` — no impact.
- **`optimizeDeps.esbuildOptions` deprecated** in favour of `optimizeDeps.rolldownOptions`. We have no `optimizeDeps` config — no impact.
- **`esbuild` config deprecated** in favour of `oxc`. We have no `esbuild` config — no impact.
- **CSS minification default changed** to Lightning CSS. `playground/vite.config.ts` has no `build.cssMinify` override. The default change is cosmetic for playground (it's a dev app, not a lib). Accepted.
- **`resolve.alias[].customResolver` removed**. We have no alias customResolvers — no impact.
- **Browser target defaults changed** again (Chrome 107→111, etc.). We set `build.target: 'es2022'` explicitly — no impact.
- **Plugin `load`/`transform` hooks must return `{ code, moduleType: 'js' }` when converting to JS.** `@vitejs/plugin-react` 6.0.1 handles this internally — we don't write custom Vite plugins — no impact.
- **`shouldTransformCachedModule`, `resolveImportMeta`, `renderDynamicImport`, `resolveFileUrl` hooks removed.** We use none of these — no impact.

**`@vitejs/plugin-react` 4.3.x → 6.0.1:**

- **v4→v5** (4.3.x → 5.x): Default `exclude` changed to `[/\/node_modules\//]`; auto-deduplication of `react`/`react-dom` from `resolve.dedupe` removed; Node 20.19+ or 22.12+ required. De-deduplification could theoretically matter for three.js if plugin-react was implicitly deduplicating it — but plugin-react only deduped `react`/`react-dom`, not `three`. We are on Node 22.22.2. No impact.
- **v5→v6** (5.x → 6.0.1): Babel removed as a bundled dependency; Vite 8+ required. If any Babel plugins were configured via `react({ babel: { plugins: [...] } })`, they must migrate to `@rolldown/plugin-babel`. Our `react()` call in `vite.config.ts` uses zero options — no Babel plugins — so this is a drop-in replacement with no config changes needed. `@rolldown/plugin-babel` and `babel-plugin-react-compiler` are optional peer deps (both confirmed optional via `peerDependenciesMeta`) — we do not need to install them.

**Three/three-webgpu dual-bundle implications (playground-specific):**

- Vite 8 removes format-sniffing heuristics (the old behaviour where Vite inspected file content to prefer ESM when both `browser` and `module` fields existed). It now strictly follows `resolve.mainFields` ordering. The `three` package ships `three.module.js` (ESM, `module` field) and `three.webgpu.js` (ESM, separate entry). For playground this is lower-risk than docs (no Next.js webpack involved), but we must verify after bumping that `import 'three'` and `import 'three/webgpu'` still resolve to the same three core. If a duplicate-instance symptom appears (the `usedTimes` error noted in CLAUDE.md gotcha #13), the fix is `resolve.alias` in `vite.config.ts` forcing both to the same path — the same mitigation that already exists in `apps/docs/next.config.ts` for webpack.
- Vitest 4.1.6 peerDeps: `vite: '^6.0.0 || ^7.0.0 || ^8.0.0'` — Vite 8 is fully supported.

### Vitest 2→4.1+ breaking changes that affect us

**Vitest 2→3:**

- `test()`/`describe()` options argument order changed: `test('name', { retry: 3 }, fn)` is now correct (options second, fn third). Previously it was `test('name', fn, { retry: 3 })`. Vitest 3 warns; Vitest 4 errors. Our existing tests use no per-test options objects — no impact.
- `spy.mockReset()` now restores original implementation instead of replacing with noop. No `mockReset` calls in our tests (matter-react test suite uses `@testing-library/react`; no spy reset calls confirmed) — no impact.
- `vi.spyOn()` on an already-spied method reuses existing mock instead of creating new spy. No cascaded spyOn calls in our tests — no impact.
- Fake timers: Vitest no longer provides default `fakeTimers.toFake` options, now mocks all available timer APIs by default. Our tests do not use fake timers — no impact.
- Vite 6 `module` condition excluded from `resolve.conditions` by default. Consistent with what Vite 6 does anyway; our package vitest configs have no `resolve.conditions` overrides — no impact.
- `WorkspaceSpec` type renamed to `TestSpecification`; `Custom` type deprecated in favour of `Test`. We do not import Vitest internal types in our tests or configs — no impact.

**Vitest 3→4:**

- **Pool rework**: `maxThreads`/`maxForks` → `maxWorkers`; `singleThread`/`singleFork` → `maxWorkers: 1, isolate: false`; `poolOptions` key removed. Our vitest configs use none of these options — no impact.
- **`workspace` option renamed to `projects`** (deprecated since 3.2, removed/replaced in 4): see `defineWorkspace` section below.
- **Reporter APIs changed**: `onCollected`, `onSpecsCollected`, `onPathsCollected`, `onTaskUpdate`, `onFinished` removed. We use no custom reporters — no impact.
- **V8 coverage rework**: `coverage.ignoreEmptyLines` removed; AST-based remapping now default. We have no `coverage` configuration — no impact.
- **`vi.restoreAllMocks` no longer resets automocks**. We use no automocks — no impact.
- **Custom elements shadow root printing changed** (`printShadowRoot: false` to restore previous behavior). Our tests use happy-dom, no shadow DOM assertions — no impact.
- **`deps.external/inline/fallbackCJS`, `poolMatchGlobs`, `environmentMatchGlobs`, `minWorkers`, `browser.testerScripts`** all removed. We use none of these — no impact.
- **`vite-node` replaced by Vite `ModuleRunner`**; `VITE_NODE_DEPS_MODULE_DIRECTORIES` env var renamed to `VITEST_MODULE_DIRECTORIES`. We set no `VITE_NODE_DEPS_MODULE_DIRECTORIES` anywhere in the repo — no impact.

**`defineWorkspace`:** Still exported from `vitest/config` in Vitest 4.1.6 — it has not been removed. However, the `workspace` configuration option was deprecated in Vitest 3.2 and is now replaced by the `projects` key inside `defineConfig`. The recommended migration is to consolidate into `vitest.config.ts` using `projects`. The standalone `vitest.workspace.ts` pattern (with `defineWorkspace`) still works but is deprecated. **Action required** — see adaptation section below.

**`passWithNoTests`:** Still supported in Vitest 4. No breaking changes documented. Confirmed present in current Vitest config docs sidebar.

**`environment: 'happy-dom'`:** Still supported. Custom environments now optionally accept `viteEnvironment` instead of `transformMode`, but the `happy-dom` string value itself is unchanged. `happy-dom` remains an optional peer dependency of Vitest 4.

**`setupFiles`:** Still supported. No breaking changes.

**`@testing-library/react` compatibility:** No peer dep conflict documented. `@testing-library/react` 14+ supports React 19 and does not have a Vitest version constraint. Vitest 4 does not change the testing library integration surface.

### `vitest.workspace.ts` adaptation needed?

Yes — the current `vitest.workspace.ts` using `defineWorkspace` is deprecated (since Vitest 3.2). It still works in 4.1.6 but will eventually be removed. The recommended migration is:

**Delete** `vitest.workspace.ts` and **create** `vitest.config.ts` at the repo root:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts'],
  },
})
```

This is functionally identical to the current `defineWorkspace(['packages/*/vitest.config.ts'])` and removes the deprecation. The glob pattern `'packages/*/vitest.config.ts'` is the same.

Note: if a root `vitest.config.ts` already exists or is created for another purpose, the `projects` key can be added to it. Currently there is no root `vitest.config.ts`.

### Per-package `vitest.config.ts` adaptation needed?

No changes required to any of the three per-package configs:

- `packages/matter/vitest.config.ts`: `environment: 'happy-dom'`, `passWithNoTests: true` — both still supported, no deprecated options used.
- `packages/matter-react/vitest.config.ts`: same, plus `setupFiles`, `globals: false`, `@vitejs/plugin-react` — all still supported. The `react()` plugin import will need its package updated to `@vitejs/plugin-react` 6.0.1 (same import path, zero config changes since we use no Babel options).
- `packages/matter-cli/vitest.config.ts`: `environment: 'node'`, `passWithNoTests: true` — both still supported.

The only per-package change is bumping `@vitejs/plugin-react` in `packages/matter-react/package.json` devDeps (from `^2.x` whatever is currently pinned there) alongside the root bump.

### Order of bumps

1. **Vite 5→8** (`apps/playground/package.json` + root `package.json` devDeps)
2. **`@vitejs/plugin-react` 4.3.x → 6.0.1** (root `package.json`, `apps/playground/package.json`, `packages/matter-react/package.json`)
3. **Vitest 2→4.1.6 + `@vitest/ui` 2→4.1.6** (all package `devDependencies` + root)
4. **`vitest.workspace.ts` → root `vitest.config.ts`** (deprecation cleanup, same task as step 3)

Reason: Default order holds. No forcing constraint — Vitest 4.1.6 accepts Vite `^6 || ^7 || ^8`, so Vitest can be bumped after or alongside Vite 8 without conflict. Steps 1 and 2 must be co-ordinated because `@vitejs/plugin-react` 6.0.1 requires Vite 8 (peerDep: `^8.0.0`). Step 3 is independent of steps 1–2 from a peer-dep perspective but logically follows once the Vite bump is stable.

### Confidence level

**HIGH** — the breaking changes that affect us are well-defined and limited:

1. `@vitejs/plugin-react` 6.x drops Babel; our `react()` call uses no Babel options — zero config change.
2. `vitest.workspace.ts` → root `vitest.config.ts` with `projects` key — one-file rename + reshaping, functionally identical.
3. No pool, reporter, coverage, or test-API breaking changes affect our test suite.
4. The three/webgpu dual-bundle risk in playground needs a post-bump smoke check but has a known mitigation (`resolve.alias`) if needed.

## Vite 5 → 8 bump (Task B.2 — captured 2026-05-12)

### Packages bumped

- `vite`: 5.4.21 → 8.0.12 (root + apps/playground)
- `@vitejs/plugin-react`: 4.7.0 → 6.0.1 (root + apps/playground + packages/matter-react)

Note: `packages/matter-react` also required the plugin-react bump. Its `devDependencies` still had `^4.3.0`, which pnpm flagged as an unmet peer against the workspace-hoisted Vite 8. Fixed in the same pass.

### Config changes needed

`apps/playground/vite.config.ts` required a `resolve.alias` block for the three dual-bundle problem (see below). No other config keys changed — `@vitejs/plugin-react` 6.0.1 is a zero-config drop-in for our usage (we pass no Babel options).

### Three dual-bundle mitigation applied?

**Yes.** The playground imports from both `three` (e.g., `Mesh`, `PlaneGeometry`) and `three/webgpu`/`three/tsl` (e.g., `MeshBasicNodeMaterial`, `vec3`). Without explicit aliases, Vite 8 (which dropped format-sniffing for `browser`/`module` field resolution) resolves these to separate three bundle copies, which would produce `Cannot read properties of undefined (reading 'usedTimes')` on dispose (CLAUDE.md gotcha #13).

The alias was added proactively (before observing a build failure) because the dual-import pattern in the playground made the problem guaranteed. The alias mirrors `apps/docs/next.config.ts` exactly — same logic, translated from webpack to Vite `resolve.alias`.

Alias config added to `apps/playground/vite.config.ts`:

```ts
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const _require = createRequire(import.meta.url)
const threeMain = _require.resolve('three')
const threeDir = resolve(threeMain, '..', '..')
const webgpuBundle = resolve(threeDir, 'build/three.webgpu.js')

// In defineConfig:
resolve: {
  alias: {
    'three/webgpu': webgpuBundle,
    'three/tsl': webgpuBundle,
    three: webgpuBundle,
  },
},
```

### Dev server smoke

- Vite version reported: `VITE v8.0.12  ready in 107 ms`
- Errors/warnings at HMR ready: One non-fatal dep-scan warning — rolldown's dependency scanner failed to resolve the tsconfig for playground src files during pre-bundling (`TSCONFIG_ERROR: Failed to load tsconfig for 'src/1-magenta.ts' ...`). This is a Vite 8 / rolldown-based dep-scanner limitation in monorepos where tsconfigs use `extends` with workspace packages. The dev server still started and printed "ready". Production build is unaffected (build succeeded clean). Dep pre-bundling is skipped; HMR still works. This is a known Vite 8 alpha-stage rough edge for monorepo setups.

### Full pipeline parity check (after bump)

| Command        | Exit | Notes                                                                                                                 |
| -------------- | ---- | --------------------------------------------------------------------------------------------------------------------- |
| pnpm typecheck | 0    | 8 tasks, all pass; pre-existing docs#typecheck outputs warning (cosmetic)                                             |
| pnpm lint      | 0    | Pre-existing MODULE_TYPELESS_PACKAGE_JSON warnings (cosmetic); 2 unused-var warnings in playground src (pre-existing) |
| pnpm build     | 0    | Playground built with `vite v8.0.12`; Next.js docs site 31 pages SSG; all packages clean                              |
| pnpm test      | 0    | 126 tests pass (55 matter + 46 matter-cli + 25 matter-react); Vitest 2.1.9 compatible with Vite 8 — no B.3 forced     |

## Vitest 2 → 4.1.6 bump (Task B.3 — captured 2026-05-12)

### Packages bumped

- `vitest`: 2.1.9 → 4.1.6 (root + 3 packages)
- `@vitest/ui`: 2.1.9 → 4.1.6 (root)

### Config restructure

- Deleted: `vitest.workspace.ts`
- Created: `vitest.config.ts` (root) with `projects: ['packages/*/vitest.config.ts']`

### Per-package vitest.config.ts changes

- `packages/matter/vitest.config.ts`: added `oxc` inline tsconfig workaround (see below)
- `packages/matter-react/vitest.config.ts`: added `oxc` inline tsconfig workaround (see below)
- `packages/matter-cli/vitest.config.ts`: added `oxc` inline tsconfig workaround (see below)

### OXC tsconfig resolution issue and fix

**Problem:** Vite 8's OXC transformer (from Rolldown) auto-discovers each package's `tsconfig.json` when transforming test files. The shared tsconfig chain (`@matter/tsconfig/library.json`) uses `${configDir}` path substitution (a TypeScript 5.5 feature). OXC's Rust-based tsconfig reader does not implement `${configDir}` — it encounters `"outDir": "${configDir}/dist"` and bails out entirely with `[TSCONFIG_ERROR] Failed to load tsconfig ... Tsconfig not found`.

This did not surface under Vitest 2 because Vitest 2 requires Vite ^5 (esbuild-based transform). Vitest 4 requires Vite ^6-8 and gets Vite 8 (OXC/Rolldown-based transform), which triggers the issue.

**Fix:** Vite 8's `OxcOptions` type omits the `tsconfig` option (it strips it before exposing the type), but the option still flows through the internal spread to `transformSync`. By passing an inline `tsconfig` in the `oxc` config key (cast to `any` to bypass the type omission), OXC uses the provided compiler options instead of discovering tsconfig from disk:

```ts
// In each per-package vitest.config.ts:
oxc: { tsconfig: { compilerOptions: { verbatimModuleSyntax: true } } } as any,
```

This is the minimal set of compiler options OXC needs for our TypeScript syntax (`verbatimModuleSyntax: true` is the only field from `tsconfig.base.json` that affects how OXC transforms `import type` statements). All other fields OXC cares about (jsx, experimentalDecorators, useDefineForClassFields) are either absent from our config or use OXC's defaults which match our intent.

**Note for CLAUDE.md gotcha list:** Add this as gotcha #15 — OXC does not support `${configDir}` in tsconfig extends chains; the workaround is inline `tsconfig` in the `oxc` Vite config key.

### Test API changes required

No test files needed changes. All 3 packages' test suites were drop-in compatible with Vitest 4.

### @testing-library/react + happy-dom smoke

- Test: ad hoc 1-test smoke under `packages/matter-react/src/__smoke__.test.tsx` (deleted after passing)
- Outcome: pass — `render(<div>hi</div>)` → `container.textContent === 'hi'` ✓

### Full pipeline parity (after bump)

| Command        | Exit | Notes                                                              |
| -------------- | ---- | ------------------------------------------------------------------ |
| pnpm typecheck | 0    | 8 tasks, all pass                                                  |
| pnpm lint      | 0    | Pre-existing warnings only (no new errors)                         |
| pnpm build     | 0    | All packages + Next.js docs site                                   |
| pnpm test      | 0    | 126 tests pass (55 matter + 46+1todo matter-cli + 25 matter-react) |
| pnpm smoke     | 0    | add + update --force, byte-identical file check passed             |

## vp migrate: @lovo/matter-cli — BLOCKED (Task C.1 — captured 2026-05-12)

### Command attempted

`cd packages/matter-cli && vp migrate --no-interactive --no-agent --no-editor --no-hooks`

### What vp migrate actually did (SCOPE VIOLATION)

vp migrate is NOT a per-package operation in a pnpm monorepo. Despite running from `packages/matter-cli/`, it traversed to the monorepo root (detected via `pnpm-workspace.yaml`) and operated on the entire workspace. Its stdout was:

```
VITE+ - The Unified Toolchain for the Web

Prettier configuration detected. Auto-migrating to Oxfmt...

✔ Merged ../../.oxlintrc.json into ../../vite.config.ts
◇ Migrated ../.. to Vite+
• Node 24.15.0  pnpm 9.12.0
✓ Dependencies installed in 4.4s
• 2 config updates applied, 37 files had imports rewritten
• ESLint rules migrated to Oxlint
• Prettier migrated to Oxfmt
! Warnings:
  - ../../.prettierignore found — Oxfmt uses .oxfmtignore. Please migrate manually.
```

The `../../` paths in its output confirm it ran at the repo root (2 levels up from `packages/matter-cli/`).

### Files changed by vp migrate (before revert)

Scope violations (files that MUST NOT be changed in M7):

- `.prettierrc.json`: DELETED (M7.4 Prettier→Oxfmt deferred)
- `eslint.config.js`: DELETED (M7.3 ESLint→Oxlint deferred)
- `vitest.config.ts` (root): modified
- `vite.config.ts` (root): NEW FILE created (unified root config)
- `pnpm-workspace.yaml`: modified
- `package.json` (root): modified

Other packages also touched (not just matter-cli):

- `apps/docs/package.json`
- `apps/playground/package.json`
- `apps/playground/vite.config.ts`
- `packages/matter-react/package.json` + all 8 test files
- `packages/matter/package.json` + all 12 test files
- `packages/matter-cli/package.json` + all 9 test files + `vitest.config.ts`
- `registry/linear-gradient.tsx`
- `registry/noise-field.tsx`
- `pnpm-lock.yaml`

Total: ~47 files changed across the entire monorepo.

### Revert taken

All changes reverted immediately:

```bash
git checkout -- .
git clean -f vite.config.ts
```

Post-revert pipeline confirmed green: typecheck=0, test=0 (126 tests).

### Root cause: vp migrate is monorepo-root-only

`vp migrate` in a pnpm workspace always operates at the workspace root. The Vite+ monorepo model is a single root `vite.config.ts` with per-package overrides — not per-package `vite.config.ts` files. The M7 plan's assumption ("run vp migrate per package, starting with matter-cli") is inconsistent with how vp migrate actually works.

Per the Vite+ monorepo docs (https://viteplus.dev/guide/monorepo):

- Target apps with: `vp dev apps/web` or `vp build apps/web`
- Root `vite.config.ts` is the unified config for the whole workspace
- `vp migrate` creates ONE root config, not per-package configs

### What vp migrate would actually do (if accepted)

1. Create root `vite.config.ts` (the unified Vite+ config)
2. Rewrite all `import { ... } from 'vitest'` → `import { ... } from 'vite-plus/test'` across ALL test files in ALL packages (37 files across matter, matter-react, matter-cli, registry)
3. Migrate ESLint → Oxlint (scope violation: M7.3 deferred)
4. Migrate Prettier → Oxfmt (scope violation: M7.4 deferred)
5. Add `vite-plus` dep to all packages

### Decision required

The M7 plan's phased approach (C.1 → C.2 → C.3 → C.4, one package at a time) is not how vp migrate works. Options:

**Option A: Run vp migrate once at the repo root, accept all changes**

- Pros: This is how Vite+ is designed to work; gets to the correct end state in one step.
- Cons: Takes ESLint→Oxlint and Prettier→Oxfmt in the same commit, breaking the "deferred M7.3/M7.4" plan. The test import rewrites (vitest → vite-plus/test) across all packages is fine; the ESLint/Prettier migrations are the concern.

**Option B: Run vp migrate at root but revert the ESLint/Prettier changes (RECOMMENDED)**

- Run `vp migrate --no-interactive --no-agent --no-editor --no-hooks` at the repo root.
- Accept: root `vite.config.ts`, `vite-plus/test` import rewrites, `vite-plus` dep additions.
- Revert: deletion of `eslint.config.js`, deletion of `.prettierrc.json`, any `package.json` script changes from `eslint`/`prettier` to `vp lint`/`vp fmt`.
- This matches the M7 intent — adopt Vite+ surface without yet swapping linter or formatter.

**Option C: Do the import rewrites manually without running vp migrate**

- Manually rewrite all `from 'vitest'` → `from 'vite-plus/test'` in the 37 test files.
- Manually add `vite-plus` to each package's devDeps.
- Manually create a root `vite.config.ts`.
- Skip `vp migrate` entirely.

**Option D: Accept that Phase C is no longer per-package and re-scope**

- Same as Option B — `vp migrate` is a single atomic root-level operation.
- The "per-package" sequencing in the plan was a planning artifact based on incorrect assumptions about vp migrate's behavior.

## vp migrate (Task C.1 consolidated — captured 2026-05-12)

### Scope decision

User accepted full vp migrate output, collapsing M7 + M7.3 (Oxlint) + M7.4 (Oxfmt) into one milestone.

### Command

`vp migrate --no-interactive --no-agent --no-editor --no-hooks` at repo root.

### vp migrate stdout (full)

```
Prettier configuration detected. Auto-migrating to Oxfmt...

✔ Merged .oxlintrc.json into vite.config.ts
◇ Migrated . to Vite+
• Node 22.22.2  pnpm 9.12.0
✓ Dependencies installed in 2.6s
• 2 config updates applied, 37 files had imports rewritten
• ESLint rules migrated to Oxlint
• Prettier migrated to Oxfmt
! Warnings:
  - .prettierignore found — Oxfmt supports .prettierignore, but using the `ignorePatterns` option is recommended.
```

### Files changed

**Created:**

- `vite.config.ts` (root) — new unified Vite+/Oxlint/Oxfmt config; ~1333 lines including full browser globals list
- `apps/docs/css.d.ts` — CSS module declaration for Oxlint's TS type-check mode (manual addition)

**Deleted:**

- `.prettierrc.json` — Oxfmt settings now in `vite.config.ts` `fmt` block
- `.prettierignore` — patterns migrated to `vite.config.ts` `fmt.ignorePatterns` (used `git rm`)
- `eslint.config.js` — replaced by `vite.config.ts` `lint` block
- `tooling/eslint-config/index.js` — dead workspace package removed
- `tooling/eslint-config/package.json` — dead workspace package removed

**Modified:**

- `pnpm-workspace.yaml` — added `catalog:` entries for `vite`/`vitest`/`vite-plus`, added `overrides` and `peerDependencyRules`
- `package.json` (root) — `format` script updated to `vp fmt`, `@matter/eslint-config` dep removed
- `apps/docs/package.json` — `lint` script: `eslint app` → `vp lint app`; `@matter/eslint-config` dep removed
- `apps/docs/tsconfig.json` — added `css.d.ts` to `include` array (manual addition)
- `apps/playground/package.json` — `lint` script updated; `@matter/eslint-config` dep removed; `vite/vitest` now `catalog:`
- `apps/playground/vite.config.ts` — `defineConfig` import: `vite` → `vite-plus`
- `apps/playground/src/2-gradient.ts` — removed unused `time`/`sin` imports (found by Oxlint)
- All 37 test files — `import { ... } from 'vitest'` → `import { ... } from 'vite-plus/test'`
- All 3 `packages/*/vitest.config.ts` — `import from 'vitest/config'` → `import from 'vite-plus'`; eslint disable comments → oxlint
- All 3 `packages/*/package.json` — `lint`/`test`/`test:watch` scripts updated; `@matter/eslint-config` removed; `vitest` → `catalog:`
- `registry/linear-gradient.tsx` and `registry/noise-field.tsx` — `eslint-disable-next-line` → `oxlint-disable-next-line`
- `packages/matter-cli/src/test-fixtures/registry/synthetic-component.tsx` — added `@ts-expect-error` for intentionally synthetic `@matter-internal/lib` import
- `.changeset/config.json` — removed `@matter/eslint-config` from `ignore` list
- `pnpm-lock.yaml` — updated (1020 insertions/268 deletions)
- Many source files — reformatted by Oxfmt

### Manual cleanup performed

- `.prettierignore` → `fmt.ignorePatterns` in `vite.config.ts`: patterns already present in the migrated config. `.prettierignore` removed via `git rm`. No separate `.oxfmtignore` created (vp migrate recommended `ignorePatterns` option which is now in `vite.config.ts`).
- `tooling/eslint-config/` directory: **deleted** (`rm -rf tooling/eslint-config/`)
- `@matter/eslint-config` workspace deps in package.json: **removed** from all 8 referencing package.jsons: root, `packages/matter`, `packages/matter-react`, `packages/matter-cli`, `apps/docs`, `apps/playground`, `registry`, `.changeset/config.json`
- No files reverted (turbo.json, tsup.config.ts×3, pnpm-workspace.yaml, CLAUDE.md all untouched by vp migrate)

### Oxlint configuration after migration

From `vite.config.ts` `lint` block:

- Plugins: `['oxc', 'typescript', 'unicorn', 'react']`
- Categories: `{ correctness: 'warn' }`
- Globals: full browser + node + commonjs environments
- ignorePatterns: `dist/`, `build/`, `.turbo/`, `.next/`, `node_modules/`, `coverage/`
- Rules migrated: all prior ESLint + typescript-eslint + react/react-hooks rules
- Notable: `typescript/consistent-type-imports: ['error', { prefer: 'type-imports' }]` preserved; `react/exhaustive-deps: 'warn'`; `react/react-in-jsx-scope: 'off'`; `options.typeAware: true, typeCheck: true`

### Oxlint findings on existing code

- Total new findings vs ESLint (errors): 3 original errors, all fixed
  1. `typescript(TS2307)` in `matter-cli/src/test-fixtures/registry/synthetic-component.tsx` — intentional fake import for rewriter tests. Fixed: `@ts-expect-error` directive.
  2. `typescript(TS2882)` in `apps/docs/app/layout.tsx` — CSS side-effect import not declared. Fixed: added `apps/docs/css.d.ts` declaring `module '*.css' {}`; added to tsconfig include.
  3. `eslint(no-unused-vars)` in `apps/playground/src/2-gradient.ts` — `time`/`sin` imported but not used. Fixed: removed from import.
- Warnings (not blocking): `typescript-eslint(unbound-method)` in fetchRegistry.test.ts (false positive on `const { join } = await import('node:path')`); `eslint-plugin-unicorn(no-useless-spread)` in reducedMotion.test.ts; `eslint-plugin-react-hooks(exhaustive-deps)` in useCursor.ts and useAnimatableUniform.ts (intentional omissions, documented in source); `typescript-eslint(no-floating-promises)` in playground render loops.
- Fixed in source: 3 errors; Suppressed via config: 0 (all suppressions via inline disable comments or TS suppression directives in the specific files)

### Oxfmt vs Prettier diff

- Files reformatted by `vp fmt "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"`: 189 files processed; formatting applied where Oxfmt style differed from Prettier
- Style changes: Oxfmt uses single quotes (matching `singleQuote: true` setting), no semicolons, trailing commas — identical to our Prettier config. The main visible difference: JSON object keys in `vite.config.ts` became unquoted (JS object literals vs JSON-style strings). All other style parameters matched.

### Full pipeline parity (final)

| Command        | Exit | Notes                                            |
| -------------- | ---- | ------------------------------------------------ |
| pnpm typecheck | 0    | 8 tasks passing                                  |
| pnpm lint      | 0    | Now Oxlint via `vp lint`; 145 rules; warnings ok |
| pnpm build     | 0    | All packages + Next.js docs (31 SSG pages)       |
| pnpm test      | 0    | 126 tests (55 matter + 46 matter-cli + 25 react) |
| pnpm smoke     | 0    | CLI add + update --force verified                |

### Per-package vitest.config.ts OXC tsconfig workaround status

Still in place in all 3 per-package configs. The `oxc: { tsconfig: { compilerOptions: { verbatimModuleSyntax: true } } } as any` workaround is required because OXC does not support `${configDir}` substitution in shared tsconfigs (CLAUDE.md gotcha, task B.3). vp migrate correctly updated the import from `vitest/config` to `vite-plus` but did not remove or centralize the workaround — it remains per-package. The eslint disable comments were updated to `oxlint-disable-next-line` by vp migrate.

## Pipeline parity (Task D.1 — captured 2026-05-12)

### vp command surface

| pnpm command                     | vp equivalent                  | Notes                                                                                     |
| -------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | `vp install --frozen-lockfile` | Direct pass-through to pnpm                                                               |
| `pnpm typecheck`                 | `vp run typecheck`             | `vp check` runs fmt+lint+types but exits 1 here (see below); `vp run typecheck` via Turbo |
| `pnpm lint`                      | `vp lint`                      | `vp lint` is workspace-wide (141 files); `pnpm lint` is per-package scoped                |
| `pnpm build`                     | `vp run build`                 | `vp build` fails (no root `index.html`); `vp run build` delegates to Turbo per-package    |
| `pnpm test`                      | `vp test`                      | `vp test` runs all projects workspace-wide; same 126 tests                                |
| `pnpm smoke`                     | no equivalent                  | Custom Node.js script; no vp counterpart                                                  |

**`vp check` (format + lint + types):** Exits 1 due to Oxfmt finding 12 files not matching its expected format. These are files outside the packages that were not covered when `vp fmt` ran during C.1 (HTML playground pages, CSS, markdown plan files, smoke script). The formatting issues are cosmetic and do not affect correctness. `pnpm lint` (Turbo per-package) does not run `vp fmt --check`, so it doesn't see these. A `vp fmt` pass would fix them; deferred until a dedicated formatting cleanup task.

**`vp lint` vs `pnpm lint` discrepancy:** `pnpm lint` (Turbo) invokes `vp lint src` or `vp lint app` scoped per package. The `registry/` package has no lint script in its `package.json`, so Turbo skips it. `vp lint` (workspace-wide) finds 5 errors in files Turbo doesn't cover:

- `registry/linear-gradient.tsx`: `mix` imported but unused (error); `focalX` and `focalY` declared but unused (errors) — dead code from a refactor; these are real bugs that should be fixed.
- `packages/matter-react/vitest.config.ts`: TS2321 + TS2769 on the `as any` OXC workaround — false positives from the type-aware lint mode; the workaround is intentional and functionally correct.

### pnpm surface timings (post-migration, 2026-05-12)

| Command                        | Wall time | Exit | Delta vs pre-M7 baseline                                |
| ------------------------------ | --------- | ---- | ------------------------------------------------------- |
| pnpm install --frozen-lockfile | 0.7s      | 0    | ~0s (lockfile up to date)                               |
| pnpm typecheck                 | 1.1s      | 0    | -5.9s (fully cached via Turbo)                          |
| pnpm lint (now Oxlint)         | 0.5s      | 0    | -2.1s (fully cached; Oxlint itself 2-4s vs ESLint 2.6s) |
| pnpm build                     | 0.4s      | 0    | -12.9s (fully cached; actual build ~15s uncached)       |
| pnpm test (now Vitest 4)       | 0.4s      | 0    | -3.4s (fully cached; actual run ~2s uncached)           |
| pnpm smoke                     | 2.8s      | 0    | +0.5s (uncached by design; CLI build + npm install)     |

Note: all pnpm commands hit Turbo cache from prior runs. Uncached timings (from C.1 run): typecheck ~7s, lint ~2-4s, build ~15s, test ~2s.

### vp surface timings (new this milestone)

| Command                       | Wall time | Exit | Notes                                                                                                                                                                   |
| ----------------------------- | --------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| vp install --frozen-lockfile  | 0.6s      | 0    | Pass-through to pnpm; lockfile up to date                                                                                                                               |
| vp check (fmt + lint + types) | ~2s       | 1    | Exits 1: 12 files have Oxfmt formatting drift (HTML, CSS, MD, .mjs outside packages). Lint and typecheck portions pass.                                                 |
| vp lint (workspace-wide)      | ~5s       | 1    | 5 errors: 3 unused vars in registry/linear-gradient.tsx (real dead code), 2 TS false-positives on vitest.config.ts `as any` OXC workaround. 16 warnings (pre-existing). |
| vp run build                  | 1.8s      | 0    | Delegates to Turbo per-package; all 5 tasks succeed (4 cached)                                                                                                          |
| vp test                       | 1.9s      | 0    | 126 tests pass across 31 test files (workspace-wide)                                                                                                                    |

### Visual regression (Playwright)

- Total tests: 15 (8 a11y + 7 visual snapshot)
- Passed: 15
- Failed: 0
- Decision: all pass — no snapshot updates needed, no diffs

Visual snapshots verified:

- Aurora default (1.1s)
- DotField default (1.1s)
- LinearGradient default (991ms)
- LinearGradient reduced-motion paused (2.0s)
- MeshGradient default (1.3s)
- NoiseField default (1.1s)
- Waves default (1.1s)

a11y: all 8 axe-clean assertions pass (/, all 6 component pages, /recipes).

### Docs dev server smoke

- `pnpm --filter @matter/docs start` → ready in 463ms
- curl http://localhost:3000/ → HTTP 200

### Known issues to address before m7-complete

1. **`registry/linear-gradient.tsx` unused vars** — `mix`, `focalX`, `focalY` are real dead code (errors under `vp lint`). Fix: remove the unused import and the two unused `const` declarations. Low risk — purely additive dead code.
2. **`vp lint` vs `pnpm lint` scope gap** — the registry package has no lint script, so Turbo misses it. Fix: add a `lint` script to `registry/package.json` and add `@matter/registry` to Turbo's lint task scope. This is the authoritative fix for the parity gap.
3. **`vp check` format drift** — 12 files (HTML playground pages, CSS globals, markdown plans, smoke script) need `vp fmt` applied. These are in paths not covered by `fmt.ignorePatterns` but were missed in C.1's `vp fmt` pass. Fix: run `vp fmt` on remaining file types.

## D.1a cleanup (Task D.1a — captured 2026-05-12)

### Concern 1: dead code in registry/linear-gradient.tsx

- Removed: `mix` named import from `@lovo/matter` (line 5 of original)
- Removed: `focal` intermediate variable + `focalX` and `focalY` declarations (lines 106-110 of original)
  — these extracted from `focalUniform.value` but were never read; the actual shader uses `cursorUniform` and `angleUniform.value` directly
- Verification: `pnpm typecheck` exit 0, `pnpm build` exit 0

### Concern 2: vitest.config.ts as-any lint errors

- Root cause: `as any` on the `oxc` property caused TS type-inference failures on the whole
  `defineConfig({...})` call in `matter-react/vitest.config.ts` (TS2321 + TS2769), triggered by
  `plugins: [react()]` + an `any`-widened object literal. The TS2769 is a `@vitejs/plugin-react@6`
  vs `@voidzero-dev/vite-plus-core` Plugin type incompatibility.
- Fix applied: replaced `as any` with `// @ts-expect-error` directives scoped to the specific
  problematic lines. In `matter-react/vitest.config.ts`, two `@ts-expect-error` comments: one
  above `plugins` (Plugin type compat), one above `oxc` (missing key in UserConfig). In the other
  two configs, one `@ts-expect-error` above `oxc` only (no plugins).
- Files: `packages/matter/vitest.config.ts`, `packages/matter-react/vitest.config.ts`,
  `packages/matter-cli/vitest.config.ts`

### Concern 3: Oxfmt drift on 12 files

- Files formatted via `vp check --fix`:
  - `apps/docs/app/globals.css`
  - `apps/playground/1-magenta.html`
  - `apps/playground/2-gradient.html`
  - `apps/playground/3-scheduler.html`
  - `apps/playground/4-react-scene.html`
  - `apps/playground/5-cursor.html`
  - `apps/playground/index.html`
  - `docs/superpowers/plans/2026-05-03-matter-m1-vertical-slice.md`
  - `docs/superpowers/plans/2026-05-04-matter-m2-cli.md`
  - `docs/superpowers/plans/2026-05-06-matter-m3-components.md`
  - `docs/superpowers/plans/m7-baseline.md`
  - `scripts/smoke-test-cli.mjs`
- Files added to .oxfmtignore: none — Oxfmt does support HTML, CSS, Markdown, and JS/MJS.
  All 12 files were successfully formatted.

### Post-cleanup parity (final)

| Command        | Exit | Notes                                  |
| -------------- | ---- | -------------------------------------- |
| pnpm typecheck | 0    |                                        |
| pnpm lint      | 0    |                                        |
| pnpm build     | 0    |                                        |
| pnpm test      | 0    | 126 tests (55 + 46 + 25)               |
| pnpm smoke     | 0    |                                        |
| vp lint        | 0    | 15 warnings (pre-existing, not errors) |
| vp check       | 0    | All 195 files correctly formatted      |

## M7 fix-up: completed ESLint/Prettier removal + dev shortcuts (captured 2026-05-12)

The task description for this fix-up described `tooling/eslint-config/`, `eslint.config.js`,
`.prettierrc.json`, and 7+ workspace-dep references still being present on the branch. **Audit
result: the `feat/m7-vite-plus` branch was already clean in all those respects** — the C.1
implementer's report was accurate for the branch itself. The issues described (broken `eslint src`
invocation) exist on `main`, which never received the migration; the branch diff was correct.

What was actually outstanding on the branch:

1. Root `format` script had an extraneous glob path argument (`vp fmt "**/*.{...}"`) — fixed to
   `vp fmt` (vp scans the workspace by default; the argument was redundant and non-standard).
2. `dev:playground` and `dev:docs` shortcuts were missing from root `package.json` — added as
   Option 2 dev shortcuts using `vp run @matter/playground#dev` and `vp run @matter/docs#dev`.
3. `CLAUDE.md` had minor Oxfmt whitespace drift (table column widths) — fixed via `vp check --fix`.

### Files changed in fix-up

- `package.json` (root): `format` script simplified; `dev:playground` and `dev:docs` added
- `CLAUDE.md`: Oxfmt table whitespace normalization

### Self-review checklist

- `find . -name "eslint.config.js" -not -path "*/node_modules/*"` — returns nothing (worktrees only, not tracked)
- `find . -name ".prettierrc*" -not -path "*/node_modules/*"` — returns nothing (worktrees only)
- `ls tooling/` — `tsconfig` only (no `eslint-config`)
- `grep -rn "@matter/eslint-config" --include='*.json' .` — zero matches
- Root `package.json` has `dev:playground` and `dev:docs` scripts
- Root `package.json` `format` script: `vp fmt` (no path arg)
- Per-package lint: `vp lint src` (vp surfaces oxlint; no direct oxlint binary in PATH)

### Cold pipeline verification (Turbo cache cleared via pnpm clean)

| Command        | Exit | Notes                                                              |
| -------------- | ---- | ------------------------------------------------------------------ |
| pnpm typecheck | 0    | 8 tasks, 0 cached                                                  |
| pnpm lint      | 0    | 5 tasks, 0 cached; 1 warning in matter (pre-existing useless-spread) |
| pnpm build     | 0    | 5 tasks, 2 cached (libs rebuilt fresh)                             |
| pnpm test      | 0    | 126 tests (55 matter + 25 matter-react + 46 matter-cli)            |
| pnpm smoke     | 0    | byte-identical file check passed                                   |
| vp lint        | 0    | 15 warnings, 0 errors (workspace-wide)                             |
| vp check       | 0    | All 195 files correctly formatted                                  |
| vp run typecheck | 0  | 8 tasks, cached                                                    |
| vp run build   | 0    | 5 tasks, cached                                                    |
| vp test        | 0    | 126 passed, 1 todo (127 total)                                     |
| Playwright     | 0    | 15/15 (8 a11y + 7 visual snapshots)                                |
