# Matter M6: v0.1.0 publish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish v0.1.0 of `@lovo/matter`, `@lovo/matter-react`, and `@lovo/matter-cli` to public npm, such that a fresh project can `npm install @lovo/matter-cli && matter-cli init && matter-cli add linear-gradient` and render `<LinearGradient>` end-to-end against the v0.1.0 tag of the now-public `lovo-hq/matter` repo.

**Architecture:** Six bite-sized phases ending in observable gates. (1) Per-package publish metadata + per-package LICENSE files. (2) Fix the CLI registry URL org typo (`lovo` → `lovo-hq`) — registry-ref pinning is automatic via `resolveRef(__VERSION__)`, no further code change required. (3) Per-package READMEs + root README polish for the v0.1 baseline. (4) Adopt `@changesets/cli` and author the v0.1.0 changeset. (5) Pre-publish dress rehearsal: `changeset version` → build → tarball-based smoke install in a throwaway Next.js project. (6) `pnpm publish -r` from the terminal (user supplies npm 2FA), tag `v0.1.0` + `m6-complete`, post-publish smoke against public npm. No CI publish automation in v0.1 — that's M7+ work.

**Tech Stack:** pnpm 9 workspaces, Turborepo (orchestration), tsup (bundling), Vitest (unit tests), `@changesets/cli` (versioning + changelogs), npm public registry.

**Pre-flight invariants (verify before starting):**
- `gh repo view lovo-hq/matter --json visibility` returns `"PUBLIC"`.
- `git tag` includes `m5-complete`; working tree clean on `main`.
- `pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm smoke` all pass.

**Out of scope (deferred to M7+):**
- Vite Plus toolchain migration (M7 — see memory `project_matter_m7_vite_plus_migration.md`).
- CI-driven publish workflow (NPM_TOKEN secret, automation tokens, release-please-style automation).
- Registry mirror / hosted registry endpoint (CLI continues to fetch from GitHub raw).
- Renaming the working directory from `mattermix/` to `matter/` (deferred cosmetic chore).
- `apps/playground/` cleanup or removal — it stays as-is for M0/M1 archaeology.

---

## File Structure

**Created:**
- `packages/matter/LICENSE` — MIT, copy of root LICENSE
- `packages/matter-react/LICENSE` — MIT, copy of root LICENSE
- `packages/matter-cli/LICENSE` — MIT, copy of root LICENSE
- `packages/matter/README.md` — per-package README (npm uses this for the package page)
- `packages/matter-react/README.md` — per-package README
- `packages/matter-cli/README.md` — per-package README
- `.changeset/config.json` — Changesets config
- `.changeset/README.md` — written by `pnpm changeset init`
- `.changeset/<random-name>.md` — the v0.1.0 changeset (one file)
- `CHANGELOG.md` (per-package, written by `pnpm changeset version` in Phase 6.5)
- `docs/superpowers/plans/2026-05-10-matter-m6-publish-SUMMARY.md` — written at end of M6

**Modified:**
- `packages/matter/package.json` — add `keywords`, `repository`, `homepage`, `bugs`, `author`, `sideEffects`
- `packages/matter-react/package.json` — same fields as above
- `packages/matter-cli/package.json` — same fields as above (no `sideEffects` — it's a bin, not a tree-shakable lib)
- `packages/matter-cli/src/config/matterConfig.ts:18` — fix `lovo` → `lovo-hq` typo
- `packages/matter-cli/src/config/matterConfig.test.ts` — add regression test asserting default URL contains `lovo-hq/matter`
- `README.md` (root) — mark M5 complete, drop "Not yet published" notice (in Phase 6.6 after publish), document the release ritual
- `package.json` (root) — add `@changesets/cli` devDep, add `release` and `version-packages` scripts
- `pnpm-lock.yaml` — auto-regenerated when adding Changesets

**Not touched:**
- `apps/docs/`, `apps/playground/`, `apps/docs-tests/` — none of these get published.
- `registry/` — already on `main`, will be reachable at `v0.1.0` tag automatically.
- `tooling/eslint-config/`, `tooling/tsconfig/` — internal `@matter/*` packages, marked `private: true`, not published. Verify in Phase 6.1.
- `.github/workflows/ci.yml` — keep as-is; no publish job in v0.1.

---

## Phase 6.1: Per-package publish metadata + per-package LICENSE

**Goal:** Each of the three publishable packages has the metadata an npm consumer expects (description ✓, keywords, repository, homepage, bugs, author, license ✓, sideEffects), and ships a LICENSE file inside its tarball. `npm pack --dry-run` shows clean tarball contents.

**Why:** npm-page polish (consumers read package metadata to evaluate dependencies) and tooling correctness (`sideEffects: false` enables tree-shaking by bundlers like webpack/Vite). LICENSE-in-tarball is required for the MIT license to be visible to consumers without a network round-trip to GitHub — many tarball auditors look here first.

### Task 1: Verify internal packages are marked private (skip publish)

**Files:**
- Read: `tooling/eslint-config/package.json`
- Read: `tooling/tsconfig/package.json`
- Read: `registry/package.json`
- Read: `apps/docs/package.json`
- Read: `apps/docs-tests/package.json`
- Read: `apps/playground/package.json`

- [ ] **Step 1: Confirm every workspace package other than the three publishables has `"private": true`**

Run: `grep -L '"private": true' tooling/*/package.json registry/package.json apps/*/package.json`
Expected output: empty (every file matched). If any file is listed, `private: true` is missing — add it before continuing. The three publishable packages (`packages/matter`, `packages/matter-react`, `packages/matter-cli`) must NOT have `private: true`.

- [ ] **Step 2: No commit — this is a read-only verification gate**

If a missing `private: true` was added in Step 1, commit it as a separate small fix:

```bash
git add tooling/<package>/package.json
git commit -m "chore(tooling): mark internal package private to prevent accidental publish"
```

### Task 2: Add publish metadata to `@lovo/matter`

**Files:**
- Modify: `packages/matter/package.json`

- [ ] **Step 1: Add `keywords`, `repository`, `homepage`, `bugs`, `author`, `sideEffects` to package.json**

Insert after the existing `"license": "MIT",` line:

```json
  "keywords": [
    "shader",
    "shaders",
    "webgpu",
    "tsl",
    "three.js",
    "react",
    "components",
    "gradient",
    "background"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/lovo-hq/matter.git",
    "directory": "packages/matter"
  },
  "homepage": "https://github.com/lovo-hq/matter#readme",
  "bugs": {
    "url": "https://github.com/lovo-hq/matter/issues"
  },
  "author": "lovo-hq",
  "sideEffects": false,
```

The full top section becomes:

```json
{
  "name": "@lovo/matter",
  "version": "0.0.0",
  "description": "Engine for Matter — TSL primitives, renderer, scheduler. Framework-agnostic.",
  "license": "MIT",
  "keywords": [
    "shader",
    "shaders",
    "webgpu",
    "tsl",
    "three.js",
    "react",
    "components",
    "gradient",
    "background"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/lovo-hq/matter.git",
    "directory": "packages/matter"
  },
  "homepage": "https://github.com/lovo-hq/matter#readme",
  "bugs": {
    "url": "https://github.com/lovo-hq/matter/issues"
  },
  "author": "lovo-hq",
  "sideEffects": false,
  "type": "module",
  ...
}
```

- [ ] **Step 2: Validate with `npm pack --dry-run`**

Run from repo root: `pnpm --filter @lovo/matter build && cd packages/matter && npm pack --dry-run 2>&1 | tee /tmp/matter-pack.txt && cd -`

Expected: tarball contents include `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `package.json`. **Should NOT include** `src/`, `*.test.ts`, `*.tsbuildinfo`, `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts`. The `description`, `keywords`, `repository`, `homepage`, `bugs` should appear in the printed package metadata.

- [ ] **Step 3: Commit**

```bash
git add packages/matter/package.json
git commit -m "chore(matter): add npm publish metadata (keywords, repo, homepage, bugs, sideEffects)"
```

### Task 3: Add publish metadata to `@lovo/matter-react`

**Files:**
- Modify: `packages/matter-react/package.json`

- [ ] **Step 1: Add the same metadata fields, with React-specific keywords**

Insert after `"license": "MIT",`:

```json
  "keywords": [
    "shader",
    "shaders",
    "webgpu",
    "tsl",
    "three.js",
    "react",
    "react-three-fiber",
    "components",
    "hooks"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/lovo-hq/matter.git",
    "directory": "packages/matter-react"
  },
  "homepage": "https://github.com/lovo-hq/matter#readme",
  "bugs": {
    "url": "https://github.com/lovo-hq/matter/issues"
  },
  "author": "lovo-hq",
  "sideEffects": false,
```

- [ ] **Step 2: Validate with `npm pack --dry-run`**

Run: `pnpm --filter @lovo/matter-react build && cd packages/matter-react && npm pack --dry-run 2>&1 | tee /tmp/matter-react-pack.txt && cd -`

Expected: same shape as Task 2, Step 2. Tarball includes `dist/`, `package.json`.

- [ ] **Step 3: Commit**

```bash
git add packages/matter-react/package.json
git commit -m "chore(matter-react): add npm publish metadata"
```

### Task 4: Add publish metadata to `@lovo/matter-cli`

**Files:**
- Modify: `packages/matter-cli/package.json`

- [ ] **Step 1: Add metadata; CLI-specific keywords; do NOT add `sideEffects`**

The CLI is an entry-point bin (not a tree-shakable library), so `sideEffects: false` is wrong here. Insert after `"license": "MIT",`:

```json
  "keywords": [
    "matter",
    "shader",
    "cli",
    "shadcn",
    "scaffold",
    "components"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/lovo-hq/matter.git",
    "directory": "packages/matter-cli"
  },
  "homepage": "https://github.com/lovo-hq/matter#readme",
  "bugs": {
    "url": "https://github.com/lovo-hq/matter/issues"
  },
  "author": "lovo-hq",
```

- [ ] **Step 2: Validate with `npm pack --dry-run`**

Run: `pnpm --filter @lovo/matter-cli build && cd packages/matter-cli && npm pack --dry-run 2>&1 | tee /tmp/matter-cli-pack.txt && cd -`

Expected: tarball includes `dist/index.js` (with the `#!/usr/bin/env node` banner), `dist/index.d.ts`, `package.json`. Should NOT include `src/`, tests, fixtures.

Verify the bin shebang survived bundling:

```bash
head -1 packages/matter-cli/dist/index.js
```

Expected: `#!/usr/bin/env node`

- [ ] **Step 3: Commit**

```bash
git add packages/matter-cli/package.json
git commit -m "chore(matter-cli): add npm publish metadata"
```

### Task 5: Copy LICENSE into each publishable package

**Files:**
- Create: `packages/matter/LICENSE`
- Create: `packages/matter-react/LICENSE`
- Create: `packages/matter-cli/LICENSE`

- [ ] **Step 1: Copy root LICENSE into each package**

```bash
cp LICENSE packages/matter/LICENSE
cp LICENSE packages/matter-react/LICENSE
cp LICENSE packages/matter-cli/LICENSE
```

- [ ] **Step 2: Verify LICENSE appears in each tarball**

Run for each package:

```bash
pnpm --filter @lovo/matter build && cd packages/matter && npm pack --dry-run 2>&1 | grep LICENSE && cd -
pnpm --filter @lovo/matter-react build && cd packages/matter-react && npm pack --dry-run 2>&1 | grep LICENSE && cd -
pnpm --filter @lovo/matter-cli build && cd packages/matter-cli && npm pack --dry-run 2>&1 | grep LICENSE && cd -
```

Expected: each command outputs a line containing `LICENSE` (npm includes LICENSE files automatically without needing them in the `files` array).

- [ ] **Step 3: Commit**

```bash
git add packages/matter/LICENSE packages/matter-react/LICENSE packages/matter-cli/LICENSE
git commit -m "chore: ship LICENSE inside each publishable package tarball"
```

### Phase 6.1 — Validation Gate (stop and play)

**Run all of these and confirm green before starting Phase 6.2:**

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm smoke
```

Then manually inspect tarball contents:

```bash
cd packages/matter && npm pack --dry-run 2>&1 | head -60 && cd -
cd packages/matter-react && npm pack --dry-run 2>&1 | head -60 && cd -
cd packages/matter-cli && npm pack --dry-run 2>&1 | head -60 && cd -
```

**Pass criteria:**
- All five `pnpm` commands succeed.
- Each tarball includes `dist/`, `package.json`, `LICENSE` (and will include `README.md` after Phase 6.3).
- No tarball includes `src/`, `*.test.ts`, `*.tsbuildinfo`, config files.
- Each package.json has the new metadata fields visibly populated.

---

## Phase 6.2: Fix CLI registry URL org typo

**Goal:** End users running the published CLI hit the correct GitHub org. Currently the default registry URL points at `lovo/matter` (404), but the org is `lovo-hq`. Fix the typo and add a regression test so it doesn't drift again.

**Why:** This is a real bug in the published CLI default — without this fix, every fresh `matter-cli init` followed by `matter-cli add` against the public registry would 404. The registry-ref pinning to `v0.1.0` is automatic via `resolveRef(__VERSION__)` (already tested in `packages/matter-cli/src/registry/ref.test.ts`), so no additional pinning code is needed.

### Task 1: Add a failing test that pins the default registry URL org

**Files:**
- Create: `packages/matter-cli/src/config/matterConfig.test.ts`

- [ ] **Step 1: Write the test that asserts `DEFAULT_MATTER_CONFIG.registryUrl` points at `lovo-hq/matter`**

Create `packages/matter-cli/src/config/matterConfig.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { DEFAULT_MATTER_CONFIG } from './matterConfig.js'

describe('DEFAULT_MATTER_CONFIG.registryUrl', () => {
  it('points at the lovo-hq/matter org (NOT lovo/matter — that is a 404)', () => {
    expect(DEFAULT_MATTER_CONFIG.registryUrl).toContain('/lovo-hq/matter/')
    expect(DEFAULT_MATTER_CONFIG.registryUrl).not.toMatch(/\/lovo\/matter\//)
  })

  it('contains the ${ref} placeholder for resolveRef substitution', () => {
    expect(DEFAULT_MATTER_CONFIG.registryUrl).toContain('${ref}')
  })

  it('targets the registry/ subdirectory', () => {
    expect(DEFAULT_MATTER_CONFIG.registryUrl).toMatch(/\/registry$|\/registry\/$/)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @lovo/matter-cli test -- matterConfig`
Expected: 1 test fails — `points at the lovo-hq/matter org` — because the current default contains `/lovo/matter/`. The other two tests should pass.

### Task 2: Fix the typo in the default config

**Files:**
- Modify: `packages/matter-cli/src/config/matterConfig.ts:18`

- [ ] **Step 1: Replace `lovo` with `lovo-hq` in the default registryUrl**

In `packages/matter-cli/src/config/matterConfig.ts`, change line 18 from:

```typescript
  registryUrl: 'https://raw.githubusercontent.com/lovo/matter/${ref}/registry',
```

to:

```typescript
  registryUrl: 'https://raw.githubusercontent.com/lovo-hq/matter/${ref}/registry',
```

- [ ] **Step 2: Run the test and verify it passes**

Run: `pnpm --filter @lovo/matter-cli test -- matterConfig`
Expected: all 3 tests pass.

- [ ] **Step 3: Run the full CLI suite to confirm nothing else broke**

Run: `pnpm --filter @lovo/matter-cli test`
Expected: every test in the package passes (including the existing `ref.test.ts`, `add.test.ts`, `update.test.ts`, `list.test.ts`, `init.test.ts`).

- [ ] **Step 4: Run the smoke test**

Run: `pnpm smoke`
Expected: end-to-end CLI smoke passes (it uses a `file://` registry, so the URL fix doesn't affect smoke directly — but this confirms no regressions from editing matterConfig.ts).

- [ ] **Step 5: Commit**

```bash
git add packages/matter-cli/src/config/matterConfig.ts packages/matter-cli/src/config/matterConfig.test.ts
git commit -m "fix(matter-cli): correct default registryUrl org (lovo → lovo-hq)

The published CLI default pointed at github.com/lovo/matter, which is a
404 — the org is lovo-hq. Adds a regression test pinning the org name
in DEFAULT_MATTER_CONFIG.registryUrl so the typo cannot reappear."
```

### Phase 6.2 — Validation Gate (stop and play)

**Manual verification of the resolved URL at v0.1.0:**

```bash
node -e "
const { DEFAULT_MATTER_CONFIG } = require('./packages/matter-cli/dist/config/matterConfig.cjs');
const url = DEFAULT_MATTER_CONFIG.registryUrl.replace('\${ref}', 'v0.1.0');
console.log('Resolved URL:', url);
"
```

Expected output: `Resolved URL: https://raw.githubusercontent.com/lovo-hq/matter/v0.1.0/registry`

(If the CLI is built ESM-only and the `require` form fails, build first with `pnpm --filter @lovo/matter-cli build` and use a `node --input-type=module` invocation — or just open the file in an editor and verify visually.)

**Pass criteria:**
- All CLI tests pass.
- `pnpm smoke` passes.
- Resolved URL points at `https://raw.githubusercontent.com/lovo-hq/matter/v0.1.0/registry`.
- The URL is reachable in a browser **after** Phase 6.6 tags `v0.1.0` (it will 404 until then — that's expected, do not pre-tag).

---

## Phase 6.3: Per-package READMEs + root README polish

**Goal:** Every package has its own README that npm displays on the package page. Each README has a one-line "what this is", install command, minimal usage example, and a link back to the docs site / spec. Root README is updated to reflect the v0.1 baseline.

**Why:** npm package pages render the per-package README, not the root README. Without one, the package page shows the bare `description` field — unhelpful for evaluation. Per-package READMEs are also npm's expected convention.

### Task 1: Write `packages/matter/README.md` (engine)

**Files:**
- Create: `packages/matter/README.md`

- [ ] **Step 1: Write the engine README**

Create `packages/matter/README.md`:

````markdown
# @lovo/matter

Framework-agnostic engine for **Matter** — React shader components on WebGPU + Three.js TSL.

This package contains the TSL primitives, the renderer, and the scheduler. It has no React dependency. If you're using React, you almost certainly want [`@lovo/matter-react`](https://www.npmjs.com/package/@lovo/matter-react) instead — it re-exports everything here plus the React bindings.

## Install

```bash
npm install @lovo/matter three
# or: pnpm add @lovo/matter three
```

`three` is a peer dependency. Matter targets `three@^0.170.0` and uses the WebGPU TSL API exclusively.

## What's inside

- **TSL primitives**: `fbm`, `voronoi`, `colorRamp`, `quantize`, and a handful of others — composable shader fragments for procedural visuals.
- **Renderer**: thin wrapper around `WebGPURenderer` that handles canvas resize, DPR, and `setClearColor`.
- **Scheduler**: visibility/intersection-aware render loop that pauses when the canvas is off-screen or the tab is hidden.

## Minimal usage

```typescript
import { fbm, colorRamp } from '@lovo/matter'
import { uv, vec3, time } from 'three/tsl'

// Inside your TSL fragment graph:
const noise = fbm(uv().mul(4).add(time.mul(0.1)))
const color = colorRamp(noise, [
  { stop: 0.0, color: vec3(0.05, 0.05, 0.10) },
  { stop: 1.0, color: vec3(0.30, 0.50, 0.95) },
])
```

For polished drop-in components like `<LinearGradient>` and `<Aurora>`, install [`@lovo/matter-cli`](https://www.npmjs.com/package/@lovo/matter-cli) and copy them into your project.

## Docs

Full docs and live demos: <https://github.com/lovo-hq/matter>

## License

MIT — see [LICENSE](./LICENSE).
````

- [ ] **Step 2: Verify the README is included in the tarball**

```bash
pnpm --filter @lovo/matter build
cd packages/matter && npm pack --dry-run 2>&1 | grep README && cd -
```

Expected: line containing `README.md`.

- [ ] **Step 3: Commit**

```bash
git add packages/matter/README.md
git commit -m "docs(matter): add per-package README for npm page"
```

### Task 2: Write `packages/matter-react/README.md` (binding)

**Files:**
- Create: `packages/matter-react/README.md`

- [ ] **Step 1: Write the React binding README**

Create `packages/matter-react/README.md`:

````markdown
# @lovo/matter-react

React binding for **Matter** — shader components on WebGPU + Three.js TSL.

This package wraps the engine ([`@lovo/matter`](https://www.npmjs.com/package/@lovo/matter)) with React-friendly primitives: a shared `<MatterScene>` canvas, a `useShaderMaterial` hook for `@react-three/fiber` integration, and input hooks (`useCursor`, `useScroll`).

## Install

```bash
npm install @lovo/matter @lovo/matter-react react three
```

`react` (^19), `@lovo/matter`, and `three` (^0.170) are peer dependencies.

## Three rendering modes

Matter components work in three configurations:

1. **Drop-in** — each component manages its own canvas. Simplest path; one canvas per effect.
2. **Shared scene** — wrap multiple Matter components in a single `<MatterScene>` to share one canvas (faster, layered effects).
3. **Inside `@react-three/fiber`** — use `useShaderMaterial` directly inside a r3f `<Canvas>` you already own.

## Minimal usage (Mode 2: shared scene)

```tsx
import { MatterScene } from '@lovo/matter-react'
// LinearGradient is copy-pasted into your project via @lovo/matter-cli
import { LinearGradient } from '@/components/matter/linear-gradient'

export default function Hero() {
  return (
    <MatterScene>
      <LinearGradient
        colors={['#0b0c2a', '#1d1f57', '#7d2dff']}
        angle={120}
      />
    </MatterScene>
  )
}
```

## Getting components

Polished drop-in components (`<LinearGradient>`, `<Aurora>`, `<DotField>`, `<NoiseField>`, `<MeshGradient>`, `<Waves>`) ship via the shadcn-style copy-paste CLI. Install it once:

```bash
npm install -D @lovo/matter-cli
npx matter-cli init
npx matter-cli add linear-gradient
```

The component lands in `src/components/matter/linear-gradient.tsx` and is yours to edit.

## Docs

<https://github.com/lovo-hq/matter>

## License

MIT — see [LICENSE](./LICENSE).
````

- [ ] **Step 2: Verify in tarball + commit**

```bash
pnpm --filter @lovo/matter-react build
cd packages/matter-react && npm pack --dry-run 2>&1 | grep README && cd -
git add packages/matter-react/README.md
git commit -m "docs(matter-react): add per-package README for npm page"
```

Expected from grep: line containing `README.md`.

### Task 3: Write `packages/matter-cli/README.md`

**Files:**
- Create: `packages/matter-cli/README.md`

- [ ] **Step 1: Write the CLI README**

Create `packages/matter-cli/README.md`:

````markdown
# @lovo/matter-cli

shadcn-style copy-paste CLI for **Matter** — fetch polished shader components from the registry into your project, where they're yours to edit.

## Install

```bash
npm install -D @lovo/matter-cli
# or run ad-hoc: npx @lovo/matter-cli <command>
```

Requires Node 22+.

## Usage

### One-time setup

```bash
npx matter-cli init
```

Writes `matter.config.json` to your project root with sensible defaults:

```json
{
  "componentsDir": "src/components/matter",
  "registryUrl": "https://raw.githubusercontent.com/lovo-hq/matter/${ref}/registry",
  "aliases": { "@/": "src/" },
  "tsx": true
}
```

The `${ref}` placeholder is auto-substituted with the CLI's published version tag (e.g., `v0.1.0`), so you get a stable snapshot. Override with `--ref <tag|branch|sha>` if you want to track `main` or a specific commit.

### List available components

```bash
npx matter-cli list
```

### Copy a component into your project

```bash
npx matter-cli add linear-gradient
# or multiple at once:
npx matter-cli add linear-gradient aurora dot-field
```

The component lands in `componentsDir` (default `src/components/matter/`) — you own it from that point forward.

### Refresh a previously-added component

```bash
# Refresh one (errors if you have local edits):
npx matter-cli update linear-gradient

# Refresh all, overwriting local edits:
npx matter-cli update --force
```

## v1 components

`linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, `waves`.

Each component depends on `@lovo/matter` and `@lovo/matter-react`, which you install separately:

```bash
npm install @lovo/matter @lovo/matter-react three
```

## Docs

<https://github.com/lovo-hq/matter>

## License

MIT — see [LICENSE](./LICENSE).
````

- [ ] **Step 2: Verify in tarball + commit**

```bash
pnpm --filter @lovo/matter-cli build
cd packages/matter-cli && npm pack --dry-run 2>&1 | grep README && cd -
git add packages/matter-cli/README.md
git commit -m "docs(matter-cli): add per-package README for npm page"
```

Expected: line containing `README.md`.

### Task 4: Polish root README for v0.1 baseline

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the status line and milestone table**

In `README.md`, replace the current status line and Roadmap section with the updated text. Open `README.md` and replace lines 5 and 56-63.

Replace line 5:

```markdown
> **Status:** Pre-release — Milestones 0 and 1 complete. `<LinearGradient>` runs end-to-end with WebGPU + Three.js TSL. v1 catalog under active development. Not yet published to npm.
```

with:

```markdown
> **Status:** Approaching v0.1.0 — all six v1 components are implemented, performance-tuned, tested (Vitest + Playwright visual regression + axe a11y), and documented. Currently preparing for the first npm publish (M6 in progress).
```

Replace lines 56-63:

```markdown
## Roadmap

- ✅ **Milestone 0** — Repo bootstrap
- ✅ **Milestone 1** — Vertical slice: `<LinearGradient>` end-to-end (engine, React binding, registry component, Tweakpane-driven docs page)
- ⏳ **Milestone 2** — `@lovo/matter-cli` (copy-paste delivery)
- **Milestone 3** — The other 5 v1 components (MeshGradient, Aurora, DotField, NoiseField, Waves)
- **Milestone 4** — Docs site polish
- **Milestone 5** — Performance, testing, accessibility
- **Milestone 6** — v0.1.0 publish
```

with:

```markdown
## Roadmap

- ✅ **Milestone 0** — Repo bootstrap
- ✅ **Milestone 1** — Vertical slice: `<LinearGradient>` end-to-end
- ✅ **Milestone 2** — `@lovo/matter-cli` (copy-paste delivery)
- ✅ **Milestone 3** — The other 5 v1 components (MeshGradient, Aurora, DotField, NoiseField, Waves)
- ✅ **Milestone 4** — Docs site polish
- ✅ **Milestone 5** — Performance, testing, accessibility
- ⏳ **Milestone 6** — v0.1.0 publish
- **Milestone 7** — Vite Plus toolchain migration

## Releasing

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning. To prepare a release:

1. Run `pnpm changeset` and describe the change (patch / minor / major).
2. Open a PR; merge it.
3. Run `pnpm changeset version` locally — bumps versions, updates `CHANGELOG.md` per package.
4. Run `pnpm build && pnpm test && pnpm smoke` — final dress rehearsal.
5. Run `pnpm publish -r --access public` — publishes all three public packages. Requires `npm login` and 2FA.
6. `git tag v<x.y.z>` and `git push --tags`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update root README for v0.1 baseline + document release ritual"
```

### Phase 6.3 — Validation Gate (stop and play)

```bash
pnpm build
pnpm typecheck
pnpm lint
```

Then manually verify each tarball's README is included and renders sensibly:

```bash
cd packages/matter && npm pack --dry-run 2>&1 | grep -E '(README|LICENSE|dist|package)' && cd -
cd packages/matter-react && npm pack --dry-run 2>&1 | grep -E '(README|LICENSE|dist|package)' && cd -
cd packages/matter-cli && npm pack --dry-run 2>&1 | grep -E '(README|LICENSE|dist|package)' && cd -
```

Expected: each lists README.md, LICENSE, the dist files, and package.json.

**Manual play step:** Open each per-package README in your editor or markdown previewer. Read it as if you were a developer evaluating the package. Confirm: install command works, code samples are syntactically valid, links resolve.

**Pass criteria:**
- All three tarballs contain README.md and LICENSE.
- Root README accurately reflects M0–M5 complete, M6 in progress, M7 (Vite Plus) planned.
- Release ritual is documented for future you.

---

## Phase 6.4: Adopt Changesets + author the v0.1.0 changeset

**Goal:** `@changesets/cli` is installed, configured for this monorepo (private packages excluded, public access set), and a single changeset file describes the v0.1.0 release. **Do not run `changeset version` yet** — that happens in Phase 6.5 right before publishing.

**Why:** Changesets is the de-facto standard for pnpm-workspace versioning. Adopting it now (rather than hand-writing CHANGELOG.md) means M7+ changes will have a structured release flow with one tiny ceremony per change. Initial setup is ~15 min and the resulting CHANGELOG-per-package format matches what consumers expect.

### Task 1: Install Changesets

**Files:**
- Modify: `package.json` (root)
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install `@changesets/cli` as a workspace devDep**

Run from repo root:

```bash
pnpm add -Dw @changesets/cli
```

The `-w` flag installs at the workspace root (not into a sub-package).

- [ ] **Step 2: Verify it's listed in root package.json**

Run: `grep '@changesets/cli' package.json`
Expected: a line like `"@changesets/cli": "^2.27.X"` under `devDependencies`.

- [ ] **Step 3: Commit (lockfile + package.json only — config comes in next task)**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @changesets/cli as workspace devDep"
```

### Task 2: Initialize Changesets

**Files:**
- Create: `.changeset/config.json`
- Create: `.changeset/README.md`

- [ ] **Step 1: Run `pnpm exec changeset init`**

```bash
pnpm exec changeset init
```

(`pnpm exec` runs the installed bin directly; we use `exec` here because the `pnpm changeset` script alias isn't added until Task 4 of this phase. Alternatively `npx changeset init` works.)

Expected output: creates `.changeset/config.json` and `.changeset/README.md`. Prints something like "Thanks for choosing changesets" / "Now you can run `changeset` to begin."

- [ ] **Step 2: Configure `.changeset/config.json` for this monorepo**

Open `.changeset/config.json`. The default contents look like:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.5/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

Replace with:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.5/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [["@lovo/matter", "@lovo/matter-react", "@lovo/matter-cli"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@matter/registry", "@matter/eslint-config", "@matter/tsconfig", "@matter/docs", "@matter/docs-tests", "@matter/playground"]
}
```

Key changes:
- `"access": "public"` — packages publish to the public npm registry (matches each package's `publishConfig.access`).
- `"fixed": [[...]]` — the three publishable packages bump together (locked versions). This means a `patch` in any one bumps all three to the same version. Picked because the engine, binding, and CLI are co-developed; mixed versions create user confusion in the early v0.x phase.
- `"ignore": [...]` — internal `@matter/*` packages (registry, tooling, apps) are workspace-private and shouldn't be considered for releases. List them explicitly so changeset doesn't complain.

**Sanity check the ignore list against actual workspace package names:**

```bash
pnpm ls -r --depth -1 --json | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
data.forEach(p => console.log(p.name, p.private ? '(private)' : ''));
"
```

Expected: every name listed in `ignore` appears with `(private)`. The three `@lovo/*` names appear without `(private)`. If a private package isn't in `ignore`, add it. If a public package is in `ignore`, remove it.

- [ ] **Step 3: Commit**

```bash
git add .changeset/config.json .changeset/README.md
git commit -m "chore: configure Changesets for v1 monorepo (fixed @lovo/* triple, ignore @matter/* internals)"
```

### Task 3: Author the v0.1.0 changeset

**Files:**
- Create: `.changeset/v0-1-0-initial-release.md`

- [ ] **Step 1: Write the changeset directly (skip the interactive prompt for predictability)**

Create `.changeset/v0-1-0-initial-release.md`:

```markdown
---
"@lovo/matter": minor
"@lovo/matter-react": minor
"@lovo/matter-cli": minor
---

Initial public release of Matter — React shader components on WebGPU + Three.js TSL.

**`@lovo/matter`** — Framework-agnostic engine: TSL primitives (`fbm`, `voronoi`, `colorRamp`, `quantize`, …), WebGPU renderer wrapper, visibility/intersection-aware scheduler.

**`@lovo/matter-react`** — React binding: `<MatterScene>` (shared canvas), `useShaderMaterial` (r3f-compatible), input hooks (`useCursor`, `useScroll`).

**`@lovo/matter-cli`** — shadcn-style copy-paste CLI: `init`, `list`, `add`, `update`. Default registry tracks the CLI's published version tag (`v0.1.0`) so component code is stable per release.

**v1 components** (via `matter-cli add <name>`): `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, `waves`. Each component is yours to edit after copy-in.

**Requirements:** Node 22+ for the CLI. WebGPU-capable browser (Chromium-based, Safari TP, Firefox Nightly with the flag). Three.js ^0.170. React ^19.
```

The `minor` bump on a `0.0.0` baseline lands all three packages at `0.1.0` (Changesets treats `0.x` minors as the first non-patch release).

- [ ] **Step 2: Verify Changesets sees the changeset**

Run: `pnpm exec changeset status`
Expected output: prints a summary showing all three packages will bump from `0.0.0` to `0.1.0`. Looks like:

```
🦋  info Packages to be bumped at minor:
🦋  info ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🦋  info @lovo/matter
🦋  info @lovo/matter-react
🦋  info @lovo/matter-cli
```

If it doesn't show all three, the `fixed` config is wrong or the changeset frontmatter is malformed — fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add .changeset/v0-1-0-initial-release.md
git commit -m "chore: add v0.1.0 changeset (initial public release)"
```

### Task 4: Add release scripts to root package.json

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add `version-packages` and `release` scripts**

In root `package.json`, add to the `scripts` block (after `"format"`):

```json
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && pnpm test && pnpm smoke && changeset publish"
```

So the full `scripts` block becomes:

```json
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules .turbo",
    "smoke": "node scripts/smoke-test-cli.mjs",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml}\"",
    "test:visual": "turbo run test:visual",
    "test:visual:update": "turbo run test:visual:update",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && pnpm test && pnpm smoke && changeset publish"
  },
```

- [ ] **Step 2: Verify the scripts**

```bash
pnpm changeset --help
```

Expected: prints Changesets help text, listing `init`, `add`, `version`, `publish`, `status`, `tag`.

```bash
pnpm version-packages --help
```

Expected: prints help for `changeset version`.

(Don't actually run `version-packages` yet — that's Phase 6.5.)

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add Changesets release scripts to root package.json"
```

### Phase 6.4 — Validation Gate (stop and play)

```bash
pnpm changeset status
```

Expected:
- Shows 3 packages bumping at minor.
- All three resolve to version `0.1.0`.
- No warnings about unrecognized packages or missing config.

```bash
pnpm install --frozen-lockfile
```

Expected: completes without error. (If lockfile drifted, this is the moment to catch it before publish.)

```bash
pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm smoke
```

Expected: all green. The `__VERSION__` baked into the CLI is still `0.0.0` at this point (we haven't run `version-packages` yet), so the smoke uses dev-mode fall-back to `main`. That's fine — Phase 6.5 will rebuild after the version bump.

**Pass criteria:**
- `pnpm changeset status` shows the v0.1.0 release ready to roll.
- All four CI gates green.
- No leftover changeset files other than `v0-1-0-initial-release.md`, `config.json`, `README.md`.

---

## Phase 6.5: Pre-publish dress rehearsal

**Goal:** Run `changeset version` to bump all three packages to `0.1.0`, build the final tarballs, install them in a throwaway Next.js project, and confirm the import graph builds cleanly. **Do not publish to npm yet** — this is the dress rehearsal that catches problems before the irreversible step.

**Why:** Once a version is published to npm, you can `npm unpublish` within 24 hours but it's frowned upon and creates a permanent gap in the version history. A tarball-based smoke catches typings issues, missing exports, broken bin shebangs, and import-graph problems while everything is still local and reversible.

### Task 1: Run `changeset version` to bump packages

**Files (auto-modified by `changeset version`):**
- Modify: `packages/matter/package.json` (version: `0.0.0` → `0.1.0`)
- Modify: `packages/matter-react/package.json` (version: `0.0.0` → `0.1.0`)
- Modify: `packages/matter-cli/package.json` (version: `0.0.0` → `0.1.0`)
- Create: `packages/matter/CHANGELOG.md`
- Create: `packages/matter-react/CHANGELOG.md`
- Create: `packages/matter-cli/CHANGELOG.md`
- Delete: `.changeset/v0-1-0-initial-release.md` (consumed)

- [ ] **Step 1: Run version-packages**

```bash
pnpm version-packages
```

Expected output:

```
🦋  All files have been updated. Review them and commit at your leisure
🦋  If you want to release these packages, run `changeset publish`
```

- [ ] **Step 2: Inspect the resulting changes**

```bash
git diff
```

Expected:
- Three `package.json` files now show `"version": "0.1.0"`.
- Three new `CHANGELOG.md` files (one per package), each with a "## 0.1.0" entry containing the changeset body.
- `.changeset/v0-1-0-initial-release.md` deleted (consumed).
- `pnpm-lock.yaml` may show internal version updates for workspace deps — that's expected.

Spot-check the CHANGELOG content:

```bash
head -10 packages/matter/CHANGELOG.md
head -10 packages/matter-react/CHANGELOG.md
head -10 packages/matter-cli/CHANGELOG.md
```

Each should start with:

```markdown
# @lovo/matter

## 0.1.0

### Minor Changes

-   Initial public release of Matter — React shader components on WebGPU + Three.js TSL.
```

(With the package name varying.)

- [ ] **Step 3: Commit the version bump separately from the publish**

```bash
git add packages/*/package.json packages/*/CHANGELOG.md .changeset pnpm-lock.yaml
git commit -m "chore: version packages 0.0.0 → 0.1.0 (Changesets)"
```

(Keeping the version bump in a separate commit means if Phase 6.6 publish fails for any reason, you can `git revert` the publish-prep without rewriting the version bump.)

### Task 2: Final build with v0.1.0 baked in

- [ ] **Step 1: Clean and build everything fresh**

```bash
pnpm clean
pnpm install --frozen-lockfile
pnpm build
```

Expected: full clean rebuild succeeds. The CLI build now bakes `__VERSION__ = "0.1.0"`.

- [ ] **Step 2: Verify `__VERSION__` is baked correctly**

```bash
grep -o '"0\.1\.0"' packages/matter-cli/dist/index.js | head -3
```

Expected: at least one match — the version is inlined in the bundled CLI.

- [ ] **Step 3: Run all CI gates**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

Expected: all green. The smoke now runs against a CLI built with `__VERSION__ = "0.1.0"`, but since smoke uses `file://` registry it doesn't hit GitHub.

### Task 3: Tarball-based smoke install in throwaway Next.js project

**Files:**
- Create: `/tmp/matter-prepublish-smoke/` — throwaway, deleted at end

- [ ] **Step 1: Pack each publishable package**

```bash
mkdir -p /tmp/matter-prepublish-smoke
cd packages/matter && npm pack --pack-destination /tmp/matter-prepublish-smoke && cd -
cd packages/matter-react && npm pack --pack-destination /tmp/matter-prepublish-smoke && cd -
cd packages/matter-cli && npm pack --pack-destination /tmp/matter-prepublish-smoke && cd -
ls -la /tmp/matter-prepublish-smoke/
```

Expected: three `.tgz` files: `lovo-matter-0.1.0.tgz`, `lovo-matter-react-0.1.0.tgz`, `lovo-matter-cli-0.1.0.tgz`.

- [ ] **Step 2: Scaffold a fresh Next.js 15 project**

```bash
cd /tmp/matter-prepublish-smoke
npx --yes create-next-app@latest consumer --typescript --tailwind --eslint --app --src-dir --import-alias '@/*' --use-npm --no-turbo --skip-install
cd consumer
npm install --no-save \
  /tmp/matter-prepublish-smoke/lovo-matter-0.1.0.tgz \
  /tmp/matter-prepublish-smoke/lovo-matter-react-0.1.0.tgz \
  /tmp/matter-prepublish-smoke/lovo-matter-cli-0.1.0.tgz \
  three @types/three
```

Expected: install succeeds. Three is pulled in as a real dep (it's a peer dep of @lovo/matter and @lovo/matter-react).

- [ ] **Step 3: Run `matter-cli init` and `matter-cli add linear-gradient`**

```bash
npx matter-cli init
cat matter.config.json
```

Expected output of `cat`: includes `"registryUrl": "https://raw.githubusercontent.com/lovo-hq/matter/${ref}/registry"`. Confirms the typo fix is in the published bin.

```bash
# This will fail with a 404 because we haven't tagged v0.1.0 yet — that's
# Phase 6.6. Use --ref main to bypass:
npx matter-cli add linear-gradient --ref main
```

Expected: copies `src/components/matter/linear-gradient.tsx` into the consumer project.

- [ ] **Step 4: Add the imports + Next.js build**

Open `src/app/page.tsx` and replace contents with:

```tsx
'use client'
import dynamic from 'next/dynamic'

const LinearGradient = dynamic(
  () => import('@/components/matter/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
)

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <LinearGradient colors={['#0b0c2a', '#1d1f57', '#7d2dff']} angle={120} />
    </main>
  )
}
```

Add the three webpack alias from CLAUDE.md gotcha #13. Open `next.config.ts` and replace contents with:

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  webpack: (config) => {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'three$': 'three/webgpu',
      'three/tsl': 'three/build/three.tsl.js',
    }
    return config
  },
}

export default config
```

(This mirrors `apps/docs/next.config.ts`. If apps/docs has additional aliases — e.g., the build for `three/webgpu` — copy them too.)

```bash
npm run build
```

Expected: build succeeds. The unused `next/dynamic` SSR-disabled import demonstrates the runtime-only WebGPU constraint (gotcha #10 from CLAUDE.md).

- [ ] **Step 5: Clean up the throwaway**

```bash
cd ~ # or wherever you came from
rm -rf /tmp/matter-prepublish-smoke
```

### Phase 6.5 — Validation Gate (stop and play)

**At this point everything is local. Nothing has been published. The repo state is:**
- All 3 packages at version `0.1.0` in package.json + CHANGELOG.md committed.
- Tarballs build cleanly.
- Tarballs installed into a fresh Next.js project; `next build` succeeds.
- CLI registry URL is correct (printed during smoke).

**If anything failed:** debug and amend the version bump commit (or revert it and start the phase over). Do NOT proceed to Phase 6.6 until this gate is green.

```bash
git status
```

Expected: working tree clean (the throwaway dir was outside the repo). No untracked or modified files in the repo.

```bash
git log --oneline | head -10
```

Expected: most recent commit is `chore: version packages 0.0.0 → 0.1.0 (Changesets)`.

**Pass criteria:**
- `git diff` shows zero untracked changes in the repo.
- A throwaway Next.js project successfully built against tarballs of all three packages.
- The published bin's `matter.config.json` printed `lovo-hq/matter` (typo fix is in the published artifact).

---

## Phase 6.6: Publish + tag

**Goal:** Publish all three packages to public npm, tag the commit `v0.1.0` and `m6-complete`, push the tags. Verify with a real `npm install` from the public registry.

**Why this is the irreversible step:** `npm publish` cannot be undone after 24 hours, and even within the window the unpublish leaves a permanent record. Everything before this phase has been reversible (revert the commit, regenerate the changeset). After this phase, v0.1.0 exists forever.

### Task 1: Publish to npm

**This step requires the user (you, reading this) to run the publish command interactively.** The npm CLI prompts for 2FA at the terminal. Subagents executing this plan should pause here and surface the prompt to the human operator.

- [ ] **Step 1: Verify you're logged in to npm and have publish rights**

```bash
npm whoami
```

Expected: prints your npm username. If it errors, run `npm login` first.

```bash
npm access list packages @lovo 2>&1 | head -5
```

Expected: prints any existing `@lovo/*` packages and your access level. If `@lovo` is a scope you don't own and don't have publish rights to, **stop and contact whoever owns the scope** before proceeding.

- [ ] **Step 2: Dry-run publish to confirm what would happen**

```bash
pnpm publish -r --access public --dry-run --no-git-checks
```

`--no-git-checks` is needed because pnpm's default refuses to publish from a non-default branch / dirty tree, and we want to publish from `main` directly. Confirm the working tree is clean before adding this flag.

Expected: prints what would be published. Three packages, all at `0.1.0`, all `@lovo/*` scoped, all marked public access.

- [ ] **Step 3: Real publish**

```bash
pnpm publish -r --access public --no-git-checks
```

npm will prompt for the OTP (one-time password) per package — three OTP prompts in sequence (Authenticator app, security key, etc., per your npm 2FA setup).

Expected:
- `+ @lovo/matter@0.1.0`
- `+ @lovo/matter-react@0.1.0`
- `+ @lovo/matter-cli@0.1.0`

If any individual package fails (network blip, OTP timeout, etc.):
- The published packages stay published. You **cannot** "rerun the whole publish" — re-running tries to publish 0.1.0 again and errors with "version already exists" on the successful packages.
- For the failed package only, run: `cd packages/<failed> && npm publish --access public` (npm CLI directly, not pnpm).
- If you cannot recover (e.g., 2FA service is down), revert by `npm unpublish @lovo/<pkg>@0.1.0` (within 24 hours) and try again later. Do NOT bump to 0.1.1 to "fix" — that's user-confusing for the first release.

- [ ] **Step 4: Verify on public npm**

```bash
npm view @lovo/matter version
npm view @lovo/matter-react version
npm view @lovo/matter-cli version
```

Expected: each prints `0.1.0`.

```bash
npm view @lovo/matter
```

Expected: shows the package metadata you wrote in Phase 6.1 (description, keywords, repository, homepage, license).

### Task 2: Tag the publish commit

- [ ] **Step 1: Tag v0.1.0 and m6-complete**

The current `HEAD` is the commit that produced the published artifacts.

```bash
git tag -a v0.1.0 -m "v0.1.0 — initial public release of @lovo/matter, @lovo/matter-react, @lovo/matter-cli"
git tag -a m6-complete -m "M6 complete — v0.1.0 published to npm"
```

- [ ] **Step 2: Push tags**

```bash
git push origin main
git push origin v0.1.0
git push origin m6-complete
```

Expected: tags appear at `https://github.com/lovo-hq/matter/tags`.

- [ ] **Step 3: Verify the registry URL now resolves**

```bash
curl -sI https://raw.githubusercontent.com/lovo-hq/matter/v0.1.0/registry/registry.json | head -1
```

Expected: `HTTP/2 200`. (Until the tag is pushed, this is `404`. Now that the tag exists, GitHub serves the file.)

### Task 3: Post-publish smoke against real npm

- [ ] **Step 1: Install from public npm in a fresh project**

```bash
mkdir -p /tmp/matter-postpublish-smoke
cd /tmp/matter-postpublish-smoke
npm init -y
npm install -D @lovo/matter-cli
npx matter-cli init
cat matter.config.json
```

Expected: `matter.config.json` includes `"registryUrl": "https://raw.githubusercontent.com/lovo-hq/matter/${ref}/registry"`.

```bash
npx matter-cli list
```

Expected: lists `linear-gradient`, `mesh-gradient`, `aurora`, `dot-field`, `noise-field`, `waves`. The CLI's `__VERSION__` is `0.1.0`, which `resolveRef` translates to `v0.1.0` — and the GitHub raw URL we just verified is reachable returns the registry JSON.

```bash
npx matter-cli add linear-gradient
ls src/components/matter/
```

Expected: `linear-gradient.tsx` present.

```bash
cd ~
rm -rf /tmp/matter-postpublish-smoke
```

- [ ] **Step 2: Update root README to reflect published state**

In `README.md`, replace the status line again:

Old:

```markdown
> **Status:** Approaching v0.1.0 — all six v1 components are implemented, performance-tuned, tested (Vitest + Playwright visual regression + axe a11y), and documented. Currently preparing for the first npm publish (M6 in progress).
```

New:

```markdown
> **Status:** v0.1.0 published to npm 🎉 — `npm install @lovo/matter-cli && npx matter-cli init && npx matter-cli add linear-gradient` to scaffold your first component.
```

In the Roadmap, change `⏳ **Milestone 6**` to `✅ **Milestone 6**`, and change `**Milestone 7**` to `⏳ **Milestone 7**`.

```bash
git add README.md
git commit -m "docs: mark M6 complete in root README"
git push origin main
```

### Task 4: Update CLAUDE.md milestone status

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Mark M6 complete in the milestone table**

In `CLAUDE.md`, find the milestone status table and update:

Old row:

```markdown
| 6 | v0.1.0 publish | Pending | — |
```

New row:

```markdown
| 6 | v0.1.0 publish | ✅ Complete | `m6-complete` |
| 7 | Vite Plus migration | Pending | — |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): mark M6 complete + add M7 (Vite Plus) row"
git push origin main
```

### Phase 6.6 — Validation Gate (the celebration gate)

**Final checks:**

```bash
git tag | grep -E '(v0\.1\.0|m6-complete)'
```

Expected: both tags listed locally.

```bash
git ls-remote --tags origin | grep -E '(v0\.1\.0|m6-complete)'
```

Expected: both tags listed on the remote.

```bash
npm view @lovo/matter@0.1.0 dist.tarball
npm view @lovo/matter-react@0.1.0 dist.tarball
npm view @lovo/matter-cli@0.1.0 dist.tarball
```

Expected: each prints a registry URL like `https://registry.npmjs.org/@lovo/matter/-/matter-0.1.0.tgz`.

**Pass criteria:**
- All three packages live on public npm at version `0.1.0`.
- `v0.1.0` and `m6-complete` tags pushed.
- `https://raw.githubusercontent.com/lovo-hq/matter/v0.1.0/registry/registry.json` returns 200.
- A throwaway project successfully ran `matter-cli add linear-gradient` against the live registry.
- README and CLAUDE.md reflect v0.1 published.

---

## Post-M6 Wrap-up

After Phase 6.6 completes, write a SUMMARY for this plan:

**Files:**
- Create: `docs/superpowers/plans/2026-05-10-matter-m6-publish-SUMMARY.md`

The SUMMARY should record:
- What shipped (three packages, version, npm URLs).
- Total time per phase (rough estimate based on commits).
- Any new gotchas discovered during M6 (add to CLAUDE.md gotchas list if persistent).
- Any deferred follow-ups (e.g., "CI publish workflow → M7 or later", "automate per-package LICENSE copy via script → backlog").

**Memory updates after M6:**

Save a project memory `project_matter_m6_complete.md` with:
- Date shipped, npm URLs, lessons learned.
- Update `MEMORY.md` index.

This sets up the next session to pick up M7 (Vite Plus migration) cleanly.

---

## Plan Self-Review Checklist (writing-plans skill)

**Spec coverage** (mapping CLAUDE.md M6 + the conversation that produced this plan):
- ✅ Package.json metadata polish — Phase 6.1
- ✅ Per-package READMEs — Phase 6.3
- ✅ CHANGELOG via Changesets — Phase 6.4 / 6.5
- ✅ Pre-publish gates (build/typecheck/test/lint/smoke + tarball install) — Phase 6.5
- ✅ Version bump to 0.1.0 — Phase 6.5
- ✅ `pnpm publish -r --access public` — Phase 6.6
- ✅ Tag `v0.1.0` and `m6-complete` — Phase 6.6
- ✅ Smoke from public npm — Phase 6.6
- ✅ Repo public (resolved before plan) — Phase 6.6 verification
- ✅ Registry URL pinning to v0.1.0 — automatic via `resolveRef`, validated in Phase 6.5
- ✅ CLI registry URL typo fix — Phase 6.2
- ✅ Per-package LICENSE shipped — Phase 6.1 Task 5
- ✅ Internal packages marked private (publish guard) — Phase 6.1 Task 1
- ✅ Root README updated — Phase 6.3 (pre-publish) + Phase 6.6 (post-publish)
- ✅ CLAUDE.md updated — Phase 6.6 Task 4

**Placeholder scan:** No `TBD`, `TODO`, "implement later", or "similar to Task N" anywhere in the plan. Every task has full code/commands.

**Type / name consistency:**
- `DEFAULT_MATTER_CONFIG` referenced consistently (matterConfig.ts:18 → matterConfig.test.ts).
- `resolveRef(ref, cliVersion)` signature matches Phase 6.2 references and existing code.
- Package names `@lovo/matter`, `@lovo/matter-react`, `@lovo/matter-cli` consistent throughout.
- Internal scope `@matter/*` (registry, eslint-config, tsconfig, docs, docs-tests, playground) consistent in Changesets `ignore` config and the Phase 6.1 Task 1 verification.
- Tag names `v0.1.0`, `m6-complete` consistent.
