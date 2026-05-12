# M7 baseline — captured 2026-05-12

| Command | Wall time | Exit | Notes |
|---|---|---|---|
| pnpm install --frozen-lockfile | 0.7s | 0 | Lockfile up to date, nothing to install |
| pnpm typecheck | 7.0s | 0 | 4 cached; turbo warning: no outputs key for docs#typecheck (pre-existing) |
| pnpm lint | 2.6s | 0 | 2 cached; MODULE_TYPELESS_PACKAGE_JSON warnings (pre-existing, cosmetic) |
| pnpm build | 13.3s | 0 | 2 cached; full Next.js docs site SSG included |
| pnpm test | 3.8s | 0 | 2 cached; 22 test files, 80 tests (55 matter + 25 matter-react) all pass |
| pnpm smoke | 2.3s | 0 | add + update --force, byte-identical file check passed |

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
| Command | Exit | Notes |
|---|---|---|
| pnpm typecheck | 0 | 8 cached, FULL TURBO |
| pnpm lint | 0 | 5 cached, FULL TURBO; pre-existing MODULE_TYPELESS_PACKAGE_JSON warnings (cosmetic) |
| pnpm build | 0 | 5 cached, FULL TURBO; Next.js SSG 31 pages |
| pnpm test | 0 | 55 matter + 46 matter-cli + 25 matter-react = 126 tests pass |
| pnpm smoke | 0 | add + update --force, byte-identical file check passed |

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
