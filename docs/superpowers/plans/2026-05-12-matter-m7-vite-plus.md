# M7 — Vite+ Toolchain Adoption (Phase A: runtime + package manager + `vp migrate`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt Vite+ as the project's runtime + package-manager wrapper and run `vp migrate` to normalize configs onto the Vite+ surface, **without yet swapping** the underlying bundler (tsup), task runner (Turborepo), linter (ESLint), or formatter (Prettier). Land in a state where every existing developer command still works, plus the new `vp` commands work, and the project is correctly positioned for follow-on swaps in M7.1–M7.4.

**Architecture:** Vite+ is a two-binary system — a global `vp` CLI that wraps your existing package manager (`pnpm` here) and manages your Node runtime, plus a per-project `vite-plus` dep that backs `vp migrate`'s config consolidation. We bump prerequisites (Vite 5→8, Vitest 2→4.1+) in the packages that consume them, install `vite-plus` per package, run `vp migrate` per package, and verify nothing regressed. Turborepo, tsup, ESLint, and Prettier all stay in place this milestone; their replacements are deliberately scheduled as separate, opt-in milestones so each tool swap gets its own "feel it" gate.

**Tech Stack:**

- New: `vp` global CLI (Vite+ alpha, from VoidZero), `vite-plus` per-project package, Vite 8, Vitest 4.1+
- Unchanged this milestone: pnpm 9.12, Turborepo 2.2, tsup 8.3, ESLint 9.13, Prettier 3.3, Next.js 15.5, Playwright 1.48, TypeScript 5.6
- Three published packages: `@lovo/matter`, `@lovo/matter-react`, `@lovo/matter-cli`
- Two apps: `apps/docs` (Next.js — untouched this milestone), `apps/playground` (Vite consumer — only direct consumer of Vite)
- One internal: `apps/docs-tests` (Playwright)

**Risk callouts:**

1. **Vite+ is alpha** (announced March 2026). Expect rough edges. Every phase below ends at a known-good gate so you can pause and assess if something is broken.
2. **Vite 5→8 is three majors.** This affects `apps/playground` and all three packages' `vitest.config.ts` (vitest depends on Vite internals). Breaking changes will surface — read the release notes before bumping.
3. **Vitest 2→4 is two majors.** Test names, mocking APIs, and config shape may have shifted.
4. **`pnpm publish` and Changesets** must continue to work end-to-end since v0.1.1 (or v0.1.x patch) will eventually ship from this branch. The `pnpm release` script must still succeed.
5. **Three' single-bundle constraint** (CLAUDE.md gotcha #13) and `three/webgpu`'s SSR-hostility (gotcha #10) are bundler-agnostic but worth keeping in mind if any config touches `apps/docs`'s webpack aliases.

**Out of scope this milestone (deferred to follow-on plans):**

- M7.1: tsup → tsdown for `@lovo/matter`, `@lovo/matter-react`, `@lovo/matter-cli` (own plan; needs DTS-emit verification, dual ESM+CJS verification, CLI shebang verification)
- M7.2: Turborepo → `vp run` (own plan; needs cache-equivalence audit and CI integration)
- M7.3: ESLint → Oxlint (own plan; must audit rule coverage — `@typescript-eslint/consistent-type-imports`, `eslint-plugin-react-hooks`, `eslint-plugin-react/recommended` are load-bearing)
- M7.4: Prettier → Oxfmt (own plan; must diff full repo output before adopting)

These were considered for M7 and explicitly split out per the user's stop-and-play pacing preference. Each is a tool swap that deserves its own feel-it gate.

---

## File Structure

This milestone touches relatively few files because the bundler and task runner stay in place. Here's the inventory:

**Created:**

- `packages/matter/vite.config.ts` — per-package vite config (currently each package has only `vitest.config.ts`; `vp migrate` writes to `vite.config.ts`, so we pre-create it as a thin re-export of vitest config, or merge during migrate)
- `packages/matter-react/vite.config.ts` — same
- `packages/matter-cli/vite.config.ts` — same
- `apps/playground/.viteplus/` — vp-managed cache/state (gitignored)
- Root `.viteplus/` — vp-managed monorepo state (gitignored)

**Modified:**

- `package.json` (root) — bump `vite` and `vitest`; add `vite-plus` workspace devDep; `packageManager` field stays `pnpm@9.12.0` (Vite+ wraps pnpm, doesn't replace it)
- `packages/matter/package.json` — bump `vitest`; add `vite-plus`
- `packages/matter-react/package.json` — bump `vitest` and `@vitejs/plugin-react`; add `vite-plus`
- `packages/matter-cli/package.json` — bump `vitest`; add `vite-plus`
- `apps/playground/package.json` — bump `vite`, `@vitejs/plugin-react`; add `vite-plus`
- `packages/*/vitest.config.ts` — Vitest 4.x config shape may shift; verify each
- `vitest.workspace.ts` — Vitest 4 renamed `defineWorkspace` location (verify)
- `.github/workflows/ci.yml` — install + use `vp` where helpful, keep pnpm fallback paths
- `.gitignore` — add `.viteplus/` and `**/.viteplus/`
- `CLAUDE.md` — flip M7 row to "🟡 in progress" then "✅ Complete" at end
- `pnpm-lock.yaml` — natural fallout from bumps

**Untouched (explicit):**

- `tsconfig.base.json`, `tooling/tsconfig/*` — TS config
- `tooling/eslint-config/*`, `eslint.config.js` — ESLint config (kept; Oxlint migration is M7.3)
- `.prettierrc.json`, `.prettierignore` — Prettier config (kept; Oxfmt migration is M7.4)
- All three `tsup.config.ts` files (kept; tsdown migration is M7.1)
- `turbo.json` (kept; `vp run` migration is M7.2)
- `apps/docs/**` — Next.js docs site. We verify it still builds at the end but don't change its config.
- `apps/docs-tests/**` — Playwright, has its own toolchain
- All `src/**` source code in any package

---

## Phase 0 — Branch + baseline snapshot

### Task 0.1: Create the M7 working branch

**Files:**

- None modified — branch creation only

- [ ] **Step 1: Verify clean working tree on main**

Run: `git status`
Expected: working tree clean, branch `main` or fast-forwarded to main

If not on main: `git checkout main && git pull --ff-only`

- [ ] **Step 2: Create and switch to the M7 branch**

Run:

```bash
git checkout -b feat/m7-vite-plus
```

Expected: `Switched to a new branch 'feat/m7-vite-plus'`

- [ ] **Step 3: Confirm tag baseline**

Run: `git describe --tags --abbrev=0`
Expected: `m6-complete` (or `v0.1.0` — both should be on the same commit)

### Task 0.2: Capture pre-migration baseline so we can detect regressions

**Files:**

- Create: `docs/superpowers/plans/m7-baseline.md` (working scratch — deleted at end of milestone)

- [ ] **Step 1: Run full pipeline and record durations**

Run each, time the wall clock, save outputs to scratch:

```bash
time pnpm install --frozen-lockfile 2>&1 | tail -20
time pnpm typecheck 2>&1 | tail -20
time pnpm lint 2>&1 | tail -20
time pnpm build 2>&1 | tail -20
time pnpm test 2>&1 | tail -20
time pnpm smoke 2>&1 | tail -20
```

Expected: all six commands succeed. Record exit codes and timings.

- [ ] **Step 2: Write baseline note**

Create `docs/superpowers/plans/m7-baseline.md` with this exact shape (fill in actual numbers):

```markdown
# M7 baseline — captured 2026-05-12

| Command                        | Wall time | Exit | Notes |
| ------------------------------ | --------- | ---- | ----- |
| pnpm install --frozen-lockfile | XXs       | 0    |       |
| pnpm typecheck                 | XXs       | 0    |       |
| pnpm lint                      | XXs       | 0    |       |
| pnpm build                     | XXs       | 0    |       |
| pnpm test                      | XXs       | 0    |       |
| pnpm smoke                     | XXs       | 0    |       |

dist/ artifacts present:

- packages/matter/dist: <ls -la output, first 10 lines>
- packages/matter-react/dist: <same>
- packages/matter-cli/dist: <same>
```

- [ ] **Step 3: Commit baseline**

```bash
git add docs/superpowers/plans/m7-baseline.md
git commit -m "chore(m7): capture pre-migration baseline timings + artifacts"
```

**STOP-AND-PLAY GATE 0:** You have a known-good baseline. Every subsequent gate compares against it.

---

## Phase A — Adopt `vp` as runtime + package-manager wrapper

This phase is the **minimum scope** that fulfills the stated user intent ("use Vite+ to manage runtime and package manager"). Phase B (running `vp migrate`) is the natural follow-through but is explicitly gated — if Phase A surfaces alpha-stage breakage, stop here and re-plan.

### Task A.1: Install the global `vp` CLI

**Files:**

- None in repo — global install only

- [ ] **Step 1: Verify Node + pnpm versions**

Run:

```bash
node -v
pnpm -v
```

Expected: Node `v22.x.x` (matches `.nvmrc`), pnpm `9.12.0` (matches `packageManager` field). If different, fix before continuing.

- [ ] **Step 2: Install the global vp CLI**

Per the Vite+ guide, install via the published `vite-plus` package's global installer. Run:

```bash
pnpm dlx vite-plus@alpha install-cli
```

Or, if the package is published under a different name (check `npm view vite-plus dist-tags` first), substitute accordingly. Document the exact install command used in `docs/superpowers/plans/m7-baseline.md` under a new "Vite+ install" section.

- [ ] **Step 3: Verify `vp` is on PATH**

Run:

```bash
which vp
vp --version
```

Expected: a path under `~/.viteplus/` (or wherever the installer placed it), version string printed.

If `vp --version` doesn't print or `which vp` is empty, **stop** and resolve before proceeding. Vite+ alpha installers may behave differently on macOS Apple Silicon than docs assume.

- [ ] **Step 4: Sanity-check `vp` recognizes the repo**

From the repo root:

```bash
vp --help
vp env --help
```

Expected: both print without crashing. Don't run `vp env on` yet.

### Task A.2: Adopt `vp env` for Node version management

**Files:**

- Modify: `.nvmrc` (no content change — verify it stays at `22`)

- [ ] **Step 1: Read `vp env` semantics**

Run: `vp env --help`
Read the output. Confirm:

- It reads `.nvmrc` (or `.node-version`) by default
- `vp env on` opts in; `vp env off` opts out
- It does not silently overwrite system Node — it shims

Document this in a code comment-style note in `m7-baseline.md` under "vp env semantics" so the next session has it.

- [ ] **Step 2: Opt in to `vp env`**

Run: `vp env on`

Expected: vp prints what it's taking over (likely installs/links Node 22.x). If it asks for confirmation, accept.

- [ ] **Step 3: Verify Node still resolves correctly**

Run:

```bash
which node
node -v
```

Expected: `node -v` still reports `v22.x.x`. `which node` may now resolve to a vp-managed shim path (e.g., `~/.viteplus/shims/node`). That's fine.

- [ ] **Step 4: Verify pnpm still works through the shim**

Run:

```bash
pnpm -v
pnpm install --frozen-lockfile
```

Expected: pnpm version matches `9.12.0`; install completes with no diffs in `pnpm-lock.yaml`.

If the lockfile changes, **stop**. That means vp's env management is interfering with pnpm in a way we don't want for this milestone. Run `vp env off` to revert and re-plan.

- [ ] **Step 5: Commit (no repo changes expected — verify)**

Run: `git status`

Expected: clean. `vp env` writes to `~/.viteplus/`, not the repo. If anything in the repo changed, investigate before committing.

### Task A.3: Adopt `vp install` for pnpm wrapping (without removing pnpm)

**Files:**

- Modify: `.github/workflows/ci.yml` (optional this task — see step 5)

- [ ] **Step 1: Read `vp install` semantics**

Run: `vp install --help` and `vp add --help` and `vp remove --help`

Confirm from the help output:

- `vp install` detects `pnpm-lock.yaml` and delegates to `pnpm install`
- `vp add <pkg>` delegates to `pnpm add <pkg>`
- `vp remove <pkg>` delegates to `pnpm remove <pkg>`
- The `packageManager` field in root `package.json` is respected

If any of these assumptions are wrong, document in `m7-baseline.md` and revise this task before continuing.

- [ ] **Step 2: Round-trip test: install a dev dep with `vp add`, remove it**

Pick a harmless test dep that we know we don't use, e.g. `tiny-glob`. Run:

```bash
vp add -D tiny-glob -w
git diff package.json pnpm-lock.yaml | head -50
```

Expected: `tiny-glob` appears under root `devDependencies`; `pnpm-lock.yaml` updates accordingly. The diff should look identical to what `pnpm add -Dw tiny-glob` would produce.

Then remove:

```bash
vp remove tiny-glob -w
git diff package.json pnpm-lock.yaml | head -20
```

Expected: clean — both files revert to their pre-test state.

- [ ] **Step 3: Reset any unintended changes**

Run: `git status`

Expected: clean. If anything other than `pnpm-lock.yaml` (which should also be reverted now) shows changes, investigate.

If `pnpm-lock.yaml` has phantom changes after the round-trip, reset:

```bash
git checkout pnpm-lock.yaml
```

- [ ] **Step 4: Document policy: vp wraps pnpm; pnpm is still callable directly**

Append to `CLAUDE.md` in the "Common commands" section, before the existing block. Edit `CLAUDE.md`:

Find this section:

````markdown
## Common commands

```bash
# At repo root:
pnpm install                              # install/restore everything
```
````

````

Add this paragraph immediately above the bash block:
```markdown
**On runtime + package manager (post-M7):** Vite+ wraps pnpm. You can call either surface — they produce identical results. Use `vp install` / `vp add` / `vp remove` if you want the Vite+ surface; use `pnpm install` / `pnpm add` / `pnpm remove` if you don't. The `packageManager` field in `package.json` locks pnpm 9.12 either way.
````

- [ ] **Step 5: Update CI to use `vp install` (optional — only if alpha is stable in CI)**

**Decision point:** If `vp install` worked cleanly in steps 2–3, update `.github/workflows/ci.yml` to use it. If you have any hesitation about CI stability, **skip this step** — leave CI on `pnpm install --frozen-lockfile` and revisit in M7.2 (Turborepo→`vp run`) when CI is being touched anyway.

If proceeding: in `.github/workflows/ci.yml`, replace every occurrence of:

```yaml
- run: pnpm install --frozen-lockfile
```

with:

```yaml
- uses: voidzero-dev/setup-vp@v1 # verify this action exists; fall back to manual install
  if: false # gate behind a feature flag while alpha
- run: pnpm install --frozen-lockfile
```

**If `voidzero-dev/setup-vp` doesn't exist yet** (alpha — likely the case), skip this step entirely. CI keeps using pnpm. Document in `m7-baseline.md`: "CI still uses pnpm directly; vp install in CI deferred."

- [ ] **Step 6: Commit Phase A**

```bash
git add CLAUDE.md docs/superpowers/plans/m7-baseline.md
# If you touched .github/workflows/ci.yml, add it too:
git add .github/workflows/ci.yml 2>/dev/null || true
git commit -m "feat(m7): adopt vp env + vp install (runtime + package-manager wrapping)

- vp env on: vp now manages the global Node 22 runtime via shims; pnpm
  resolves through the shim and produces identical lockfile output.
- vp install / vp add / vp remove wrap pnpm; both surfaces are valid.
- pnpm 9.12 stays pinned via packageManager field; turborepo, tsup,
  eslint, prettier are unchanged this milestone."
```

**STOP-AND-PLAY GATE A — minimum-scope endpoint:**

At this point, the user's stated intent ("use Vite+ to manage runtime and package manager") is fulfilled. Validate by running:

```bash
vp --version       # vp works
vp env             # reports current managed Node
vp install         # succeeds, no lockfile changes
pnpm install       # also succeeds, no lockfile changes (parity)
pnpm typecheck     # green
pnpm lint          # green
pnpm build         # green
pnpm test          # green
pnpm smoke         # green
```

All eight commands should succeed. **If this is enough for the user, stop here and tag `m7a-complete`.** Otherwise continue to Phase B.

---

## Phase B — Bump prerequisites for `vp migrate` (Vite 8, Vitest 4.1+)

`vp migrate` requires Vite 8+ and Vitest 4.1+ already in place. We currently have Vite 5 and Vitest 2. Both bumps are major — they happen in this phase, with each verified independently.

### Task B.1: Read upstream migration guides before bumping

**Files:** No repo changes — research only

- [ ] **Step 1: Read Vite migration guides (6, 7, 8)**

Open in browser, scan for breaking changes that affect us:

- https://vite.dev/guide/migration-from-v5 (Vite 6)
- Vite 7 migration guide (search: "Vite 7 migration")
- Vite 8 migration guide (search: "Vite 8 migration")

Specifically scan for breaking changes to:

- `@vitejs/plugin-react` API (apps/playground depends on it)
- `defineConfig` config shape
- ESM/CJS handling (relevant to tsup-built packages consumed by Vite)
- `vitest/config` re-exports

Write findings to `m7-baseline.md` under a new "Vite 5→8 breaking changes that affect us" section.

- [ ] **Step 2: Read Vitest migration guides (3, 4)**

Open in browser:

- https://vitest.dev/guide/migration (Vitest 3, 4)

Scan for breaking changes affecting:

- `defineWorkspace` (we use it in `vitest.workspace.ts`)
- `passWithNoTests` option (we set this in every per-package config)
- `environment: 'happy-dom'` (still supported?)
- `globals: false` (still default-changeable?)
- `@testing-library/react` + `@vitejs/plugin-react` peer-dep compatibility

Append findings to `m7-baseline.md`.

- [ ] **Step 3: Decide order of bumps**

Default order (encoded in the next tasks):

1. Vite 5→8 in apps/playground (only direct Vite consumer)
2. `@vitejs/plugin-react` to Vite 8-compatible version
3. Vitest 2→4 across all packages
4. Re-run full pipeline; commit

**If your B.1 research surfaces a forcing constraint** (e.g., Vitest 4 requires Vite N which is older than 8), revise this order before continuing. Document the chosen order in `m7-baseline.md`.

### Task B.2: Bump Vite 5 → 8 in `apps/playground`

**Files:**

- Modify: `apps/playground/package.json` (devDependencies: `vite`, `@vitejs/plugin-react`)
- Modify: `apps/playground/vite.config.ts` (if breaking changes require it — read findings from B.1)
- Modify: `pnpm-lock.yaml` (natural fallout)

- [ ] **Step 1: Identify the target Vite 8.x version**

Run:

```bash
npm view vite versions --json | tail -30
```

Pick the latest `8.x.x` stable. Note it.

- [ ] **Step 2: Identify the Vite 8-compatible `@vitejs/plugin-react` version**

Run:

```bash
npm view @vitejs/plugin-react versions --json | tail -10
npm view @vitejs/plugin-react@latest peerDependencies
```

Confirm the latest version lists `vite: ^8` (or `^7 || ^8`) in peerDependencies.

- [ ] **Step 3: Update `apps/playground/package.json`**

Open `apps/playground/package.json`. In `devDependencies`, change:

```json
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
```

to (using the versions from steps 1–2; example shown — replace with actual):

```json
    "vite": "^8.0.0",
    "@vitejs/plugin-react": "^5.0.0",
```

- [ ] **Step 4: Update root `package.json` to match**

The root `package.json` also lists `vite` and `@vitejs/plugin-react` under `devDependencies`. Bump them to the same versions as in step 3.

- [ ] **Step 5: Reinstall and check for errors**

Run:

```bash
pnpm install
pnpm --filter @matter/playground typecheck
pnpm --filter @matter/playground build
```

Expected: all three succeed. If `vite build` fails:

- Read the error message
- Cross-reference against findings in `m7-baseline.md` Vite 5→8 section
- Likely fix: update `apps/playground/vite.config.ts` for any config-shape changes

If config changes are required, make them. Show the diff in `m7-baseline.md`.

- [ ] **Step 6: Smoke-test playground dev server**

Run:

```bash
pnpm --filter @matter/playground dev
```

Open `http://localhost:5173` (or whatever Vite prints). Verify the playground page loads and the LinearGradient demo runs. **This is the stop-and-play feel-it beat for B.2.** Take 30 seconds, watch it animate. Stop the dev server (Ctrl+C).

- [ ] **Step 7: Commit B.2**

```bash
git add apps/playground/package.json package.json pnpm-lock.yaml apps/playground/vite.config.ts docs/superpowers/plans/m7-baseline.md
git commit -m "chore(playground): bump vite 5→8 and @vitejs/plugin-react

Required by vp migrate (needs Vite 8+ before running). No source changes
to apps/playground/src/; config-shape adjustments in vite.config.ts (if
any) listed in docs/superpowers/plans/m7-baseline.md."
```

### Task B.3: Bump Vitest 2 → 4.1+ across all packages

**Files:**

- Modify: `package.json` (root devDependencies: `vitest`, `@vitest/ui`)
- Modify: `packages/matter/package.json` (devDependencies: `vitest`)
- Modify: `packages/matter-react/package.json` (devDependencies: `vitest`)
- Modify: `packages/matter-cli/package.json` (devDependencies: `vitest`)
- Modify: `vitest.workspace.ts` (Vitest 4 may have renamed `defineWorkspace`)
- Modify: `packages/*/vitest.config.ts` (if config shape changed per B.1)
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Identify Vitest 4.1+ target version**

Run:

```bash
npm view vitest versions --json | tail -20
npm view vitest@latest peerDependencies
```

Pick the latest `4.x.x` stable that is `>=4.1.0`. Confirm its `vite` peer-dep is satisfied by the Vite 8 we just installed.

- [ ] **Step 2: Bump vitest everywhere**

In each of the five files below, change `"vitest": "^2.1.0"` to `"vitest": "^4.1.0"` (or whatever the target was in step 1):

- `package.json` (root)
- `packages/matter/package.json`
- `packages/matter-react/package.json`
- `packages/matter-cli/package.json`

And in root `package.json` also bump:

- `"@vitest/ui": "^2.1.0"` → matching `"^4.1.0"` (or latest)

- [ ] **Step 3: Update `vitest.workspace.ts` for Vitest 4 if needed**

Open `vitest.workspace.ts`. Current content:

```ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(['packages/*/vitest.config.ts'])
```

Per Vitest 4 migration: `defineWorkspace` may have moved to `vitest/node` or been replaced by `projects` in `vitest.config.ts`. Check your B.1 findings.

If `defineWorkspace` is removed, replace this file's content with whatever the Vitest 4 docs prescribe for "monorepo with one config per package." Typical replacement:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts'],
  },
})
```

(Verify against actual Vitest 4 docs — this is the documented shape but the exact key may differ.)

- [ ] **Step 4: Update per-package vitest.config.ts files if needed**

For each of:

- `packages/matter/vitest.config.ts`
- `packages/matter-react/vitest.config.ts`
- `packages/matter-cli/vitest.config.ts`

Confirm these still typecheck against Vitest 4:

- `import { defineConfig } from 'vitest/config'` — verify still exported
- `test.environment: 'happy-dom'` — still supported
- `test.passWithNoTests: true` — still supported (this is gotcha #8 in CLAUDE.md)
- `test.globals: false` — still supported
- `test.setupFiles` — still supported

If any have moved, update accordingly. Show the diff in `m7-baseline.md`.

- [ ] **Step 5: Reinstall and run tests**

Run:

```bash
pnpm install
pnpm test
```

Expected: all packages report 0 failures. Some packages have 0 tests (matter, matter-react) — they should pass via `passWithNoTests`. matter-cli has real tests — they should still pass.

If tests fail because of Vitest 4 API changes (e.g., `vi.mock` shape, assertion changes), fix them in the test files. Document in `m7-baseline.md`.

- [ ] **Step 6: Verify happy-dom + @testing-library/react still pair correctly**

`packages/matter-react` has no tests today, but it has the test infrastructure (`test-setup.ts`, happy-dom, testing-library). Add a one-line throwaway smoke test to verify the harness:

Open `packages/matter-react/src/test-setup.ts`. Note current contents. If it exists and works under happy-dom, leave it.

Then add a temporary file `packages/matter-react/src/__smoke__.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

describe('vitest 4 smoke', () => {
  it('renders', () => {
    const { container } = render(<div data-testid="x">hi</div>)
    expect(container.textContent).toBe('hi')
  })
})
```

Run: `pnpm --filter @lovo/matter-react test`
Expected: 1 test passes.

- [ ] **Step 7: Remove the smoke test**

Run: `rm packages/matter-react/src/__smoke__.test.tsx`

Verify: `pnpm --filter @lovo/matter-react test` still succeeds (with 0 tests, via passWithNoTests).

- [ ] **Step 8: Commit B.3**

```bash
git add package.json packages/*/package.json packages/*/vitest.config.ts vitest.workspace.ts pnpm-lock.yaml docs/superpowers/plans/m7-baseline.md
git commit -m "chore: bump vitest 2→4.1+ (vp migrate prerequisite)

Tests pass; vitest.workspace.ts updated to vitest 4 projects shape (if
applicable). Per-package vitest.config.ts: no breaking changes found
(or: list them in m7-baseline.md)."
```

**STOP-AND-PLAY GATE B:** Run the full baseline pipeline and compare timings:

```bash
time pnpm install --frozen-lockfile
time pnpm typecheck
time pnpm lint
time pnpm build
time pnpm test
time pnpm smoke
```

All should succeed. Timings will differ — record new numbers in `m7-baseline.md`. If anything is broken, stop and fix before Phase C.

---

## Phase C — Run `vp migrate` per package

`vp migrate` consolidates tool configs into `vite.config.ts`. Per its docs, it does NOT migrate ESLint→Oxlint, Prettier→Oxfmt, or Turborepo→`vp run` — those stay as-is. What it DOES do:

- Adds `vite-plus` as a dep where appropriate
- Rewrites `'vitest'` imports to `'vite-plus/test'` in test files
- Merges any `tsdown.config.ts` into the `pack` block of `vite.config.ts` (we don't have these — skipped)
- Migrates JSON `lint-staged` config into the `staged` block (we don't have one — skipped)

We run it per package, starting with the smallest (`@lovo/matter-cli`) so failures surface on the simplest target first.

### Task C.1: Dry-run `vp migrate` on `@lovo/matter-cli` first

**Files:**

- Modify: `packages/matter-cli/package.json` (likely: add `vite-plus` to devDependencies)
- Create: `packages/matter-cli/vite.config.ts` (likely)
- Modify: `packages/matter-cli/vitest.config.ts` (likely: deleted or merged)
- Modify: `packages/matter-cli/src/**/*.test.ts` (vitest import rewrites)

- [ ] **Step 1: Read `vp migrate --help` fully**

Run: `vp migrate --help`

Confirm:

- Whether it has a `--dry-run` flag
- Whether it operates per-package or monorepo-wide
- What it prompts for

If no `--dry-run` flag exists, skip step 2 and rely on `git diff` to review.

- [ ] **Step 2: Dry-run on matter-cli**

If a dry-run flag exists:

```bash
cd packages/matter-cli
vp migrate --dry-run
cd ../..
```

Expected: vp prints what it would change. Review.

- [ ] **Step 3: Actually run migrate on matter-cli**

```bash
cd packages/matter-cli
vp migrate
cd ../..
```

Expected:

- New file `packages/matter-cli/vite.config.ts` created
- `packages/matter-cli/vitest.config.ts` possibly merged into `vite.config.ts` (or kept — depends on vp's choice)
- `packages/matter-cli/package.json` gains `vite-plus` in devDependencies
- Any `import { ... } from 'vitest'` in test files rewritten to `'vite-plus/test'`

- [ ] **Step 4: Review the diff carefully**

Run:

```bash
git diff packages/matter-cli/
git status packages/matter-cli/
```

Look for:

- Unexpected changes to `tsup.config.ts` (vp shouldn't touch it; if it did, stop and revert)
- Unexpected changes to `package.json` scripts (vp may try to rewrite `"test": "vitest run"` to `"test": "vp test"` — that's expected; if it touches `"build": "tsup"`, that's not — stop and revert)
- Vite config that imports plugins we don't have (vp may presume `@vitejs/plugin-react` — fine; but if it presumes `vite-plugin-dts`, that conflicts with our tsup-based DTS — stop)

- [ ] **Step 5: Verify matter-cli still builds, lints, and tests**

```bash
pnpm install                              # let pnpm pick up the new vite-plus dep
pnpm --filter @lovo/matter-cli typecheck
pnpm --filter @lovo/matter-cli lint
pnpm --filter @lovo/matter-cli build
pnpm --filter @lovo/matter-cli test
```

All four green: proceed. Any red: investigate, document, decide whether to fix or revert.

- [ ] **Step 6: Smoke-test the built CLI binary**

```bash
pnpm smoke
```

Expected: the smoke test (from `scripts/smoke-test-cli.mjs`) succeeds. The CLI is the only consumer-facing binary; its dist/index.js must still be a valid Node ESM entry point with the shebang preserved.

- [ ] **Step 7: Commit C.1**

```bash
git add packages/matter-cli/ pnpm-lock.yaml
git commit -m "chore(matter-cli): run vp migrate

Consolidates vitest config into vite.config.ts; rewrites 'vitest'
imports to 'vite-plus/test'. tsup config untouched. Smoke test green."
```

### Task C.2: Run `vp migrate` on `@lovo/matter`

**Files:** Same shape as C.1, in `packages/matter/`

- [ ] **Step 1: Run migrate**

```bash
cd packages/matter
vp migrate
cd ../..
```

- [ ] **Step 2: Review the diff**

`git diff packages/matter/` — verify:

- `tsup.config.ts` untouched
- `package.json` scripts: build script unchanged, test/lint scripts may shift to `vp test`/`vp lint`
- No `three` peer-dep changes

- [ ] **Step 3: Verify**

```bash
pnpm install
pnpm --filter @lovo/matter typecheck
pnpm --filter @lovo/matter lint
pnpm --filter @lovo/matter build
pnpm --filter @lovo/matter test
```

All green: proceed. Inspect `packages/matter/dist/` and confirm `index.js`, `index.cjs`, `index.d.ts` all present and non-empty (compare against baseline ls in `m7-baseline.md`).

- [ ] **Step 4: Commit C.2**

```bash
git add packages/matter/ pnpm-lock.yaml
git commit -m "chore(matter): run vp migrate

Consolidates vitest config into vite.config.ts. tsup config untouched;
ESM+CJS+DTS dist artifacts unchanged."
```

### Task C.3: Run `vp migrate` on `@lovo/matter-react`

**Files:** Same shape as C.1, in `packages/matter-react/`

- [ ] **Step 1: Run migrate**

```bash
cd packages/matter-react
vp migrate
cd ../..
```

- [ ] **Step 2: Review the diff**

`git diff packages/matter-react/` — verify:

- `@vitejs/plugin-react` is correctly included in the new `vite.config.ts` (this is the React-using package; vp should detect this)
- `tsup.config.ts` untouched
- `react` and `three` peer-deps untouched
- `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/react`, `happy-dom` still in devDependencies

- [ ] **Step 3: Verify**

```bash
pnpm install
pnpm --filter @lovo/matter-react typecheck
pnpm --filter @lovo/matter-react lint
pnpm --filter @lovo/matter-react build
pnpm --filter @lovo/matter-react test
```

All green. Confirm `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` present.

- [ ] **Step 4: Commit C.3**

```bash
git add packages/matter-react/ pnpm-lock.yaml
git commit -m "chore(matter-react): run vp migrate

Consolidates vitest config (with @vitejs/plugin-react) into
vite.config.ts. tsup config untouched."
```

### Task C.4: Run `vp migrate` on `apps/playground`

`apps/playground` is a Vite app (not a tsup-built package). `vp migrate` here may behave differently — it might be a near no-op since the Vite config already exists, or it might consolidate further.

**Files:**

- Modify: `apps/playground/package.json` (scripts shift to vp surface)
- Modify: `apps/playground/vite.config.ts`

- [ ] **Step 1: Run migrate**

```bash
cd apps/playground
vp migrate
cd ../..
```

- [ ] **Step 2: Review the diff**

`git diff apps/playground/`

- [ ] **Step 3: Verify dev + build**

```bash
pnpm install
pnpm --filter @matter/playground typecheck
pnpm --filter @matter/playground build
pnpm --filter @matter/playground dev   # open in browser, watch LinearGradient render
```

LinearGradient still animates. Ctrl+C the dev server.

- [ ] **Step 4: Commit C.4**

```bash
git add apps/playground/ pnpm-lock.yaml
git commit -m "chore(playground): run vp migrate

Vite app already had vite.config.ts; migrate normalized scripts to
vp surface but left bundler choice unchanged."
```

### Task C.5: Decide what to do about `apps/docs` and `apps/docs-tests`

**Files:** Decision documented in `m7-baseline.md`; possibly no code changes

- [ ] **Step 1: Read the situation**

- `apps/docs` is a **Next.js app**, not a Vite app. It has no `vite.config.ts`. `vp migrate` is not meaningful here — there's nothing for it to consolidate, since Next has its own config (`next.config.ts`).
- `apps/docs-tests` is a **Playwright project**, not a Vite app. Same logic.

- [ ] **Step 2: Do NOT run `vp migrate` in `apps/docs` or `apps/docs-tests`**

Document this decision in `m7-baseline.md` under a new "Phase C: docs apps deliberately skipped" section, with reasoning. Future readers (and Claude in future sessions) will wonder.

- [ ] **Step 3: Verify docs site still builds**

```bash
pnpm --filter @matter/docs typecheck
pnpm --filter @matter/docs build
```

Both green. (No commit — nothing changed.)

**STOP-AND-PLAY GATE C — feel-it beat:**

Run the docs dev server, browse the gallery, click around. Verify every component still renders, every Tweakpane control still works. This is a 5-minute manual smoke that catches regressions purely visual tests would miss.

```bash
pnpm --filter @matter/docs dev
# Open http://localhost:3000, walk through every component page
```

Stop the server. If anything regressed, **stop here** and investigate before Phase D.

---

## Phase D — Verify everything still works end-to-end

### Task D.1: Full pipeline parity check

**Files:**

- Modify: `docs/superpowers/plans/m7-baseline.md` (record post-migration timings)

- [ ] **Step 1: Re-run the full pipeline, both old and new surfaces**

Old surface (must still work — pnpm/turbo/tsup/eslint/prettier untouched):

```bash
time pnpm install --frozen-lockfile
time pnpm typecheck
time pnpm lint
time pnpm build
time pnpm test
time pnpm smoke
```

New surface (should also work — vp wraps the same tools):

```bash
time vp install
time vp typecheck     # or vp run typecheck, depending on vp's command surface — check vp --help
time vp lint
time vp build
time vp test
```

(`vp smoke` doesn't exist — smoke is a custom script. Keep using `pnpm smoke`.)

Expected: every command exits 0 on both surfaces. Timings recorded.

If `vp lint` runs Oxlint by default (rather than delegating to our ESLint setup), it may fail or produce different output than `pnpm lint`. That's expected — we have NOT migrated to Oxlint yet. Decision:

- If `vp lint` fails because it can't find Oxlint config, that's fine — leave it. Document in `m7-baseline.md`.
- If `vp lint` runs Oxlint and produces a flood of new lint errors, that's a sign Phase E (M7.3 Oxlint migration) will be nontrivial. Document. Don't fix here.

- [ ] **Step 2: Record results in baseline doc**

Append a "Post-M7 pipeline timings" section to `m7-baseline.md` with all 11 timings (6 old + 5 new).

- [ ] **Step 3: Visual regression — Playwright**

```bash
pnpm --filter @matter/docs-tests test:visual
```

Expected: all snapshots match (no visual regressions). If any fail, investigate — most likely cause is a font or rasterization difference from the Next.js dev/build cycle picking up a new dep version, NOT a Matter regression. Diff the snapshots manually before accepting any updates.

- [ ] **Step 4: Commit D.1**

```bash
git add docs/superpowers/plans/m7-baseline.md
git commit -m "chore(m7): record post-migration baseline; pipeline parity verified

Both pnpm and vp surfaces produce identical typecheck/lint/build/test
results. Visual regression suite passes. ESLint/Prettier/tsup/turbo
unchanged this milestone (deferred to M7.1–M7.4)."
```

### Task D.2: Update `.gitignore` for vp artifacts

**Files:**

- Modify: `.gitignore`

- [ ] **Step 1: Append vp ignores**

Open `.gitignore`. Append at the end:

```
# Vite+ (M7)
.viteplus/
**/.viteplus/
```

- [ ] **Step 2: Verify nothing currently tracked**

Run:

```bash
git ls-files | grep viteplus || echo "none tracked"
```

Expected: "none tracked". If anything matches, decide whether it should be tracked (probably not — remove via `git rm --cached`).

- [ ] **Step 3: Commit D.2**

```bash
git add .gitignore
git commit -m "chore: gitignore Vite+ artifacts (.viteplus/)"
```

### Task D.3: Delete the working baseline scratch doc

**Files:**

- Delete: `docs/superpowers/plans/m7-baseline.md`

**Decision point:** the baseline doc was a working scratch — it tracked what we measured during the migration. Decide:

- **Keep it** as a permanent record (useful for future migrations referencing this one as precedent), OR
- **Delete it** (it's churn; the relevant findings are already in commits and CLAUDE.md).

Default: **keep it**, but rename to clarify intent.

- [ ] **Step 1: Rename for clarity**

```bash
mv docs/superpowers/plans/m7-baseline.md docs/superpowers/plans/2026-05-12-matter-m7-notes.md
```

- [ ] **Step 2: Commit D.3**

```bash
git add -A docs/superpowers/plans/
git commit -m "docs(m7): preserve migration notes alongside the plan"
```

### Task D.4: Update CLAUDE.md milestone status

**Files:**

- Modify: `CLAUDE.md` (M7 row in the milestone status table)

- [ ] **Step 1: Open CLAUDE.md and find the milestone table**

Current row:

```markdown
| 7 | Vite Plus toolchain migration | Pending | — |
```

- [ ] **Step 2: Edit the row to reflect Phase A completion**

Replace with:

```markdown
| 7 | Vite+ adoption (runtime + pkg mgr + `vp migrate`) | ✅ Complete | `m7-complete` |
| 7.1 | tsup → tsdown (3 packages) | Pending | — |
| 7.2 | Turborepo → `vp run` | Pending | — |
| 7.3 | ESLint → Oxlint | Pending | — |
| 7.4 | Prettier → Oxfmt | Pending | — |
```

- [ ] **Step 3: Update the "Stack" paragraph in the project-shape section**

Find this paragraph:

```markdown
- **Stack**: TypeScript 5 strict mode, pnpm 9 workspaces, Turborepo (orchestration; **NOT Turbopack**), tsup (bundling, ESM+CJS+types), ESLint 9 flat config, Prettier 3, Vitest (unit tests), Next.js 15 (docs site, lives at `apps/docs/`), Tweakpane (interactive shader playground panel on the docs site). Visual regression: Playwright against the docs site routes (M5).
```

Replace with:

```markdown
- **Stack**: TypeScript 5 strict mode, pnpm 9 workspaces wrapped by Vite+ (`vp install`/`vp add`/`vp remove` ≡ pnpm equivalents), Vite+-managed Node 22 runtime (`vp env`), Turborepo (orchestration; **NOT Turbopack** — `vp run` migration deferred to M7.2), tsup (bundling, ESM+CJS+types — `tsdown` migration deferred to M7.1), ESLint 9 flat config (Oxlint migration deferred to M7.3), Prettier 3 (Oxfmt migration deferred to M7.4), Vitest 4 (unit tests; imports route through `vite-plus/test` post-`vp migrate`), Next.js 15 (docs site, lives at `apps/docs/` — untouched by M7), Tweakpane (interactive shader playground panel on the docs site). Visual regression: Playwright against the docs site routes (M5).
```

- [ ] **Step 4: Tag and commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): mark M7 complete, scaffold M7.1–M7.4 rows

M7 delivered the runtime + package-manager wrapping and ran vp migrate
to consolidate vitest configs onto the Vite+ surface. tsup/turbo/eslint/
prettier swaps were deliberately split into M7.1–M7.4 for stop-and-play
pacing — each is its own feel-it gate."
git tag m7-complete
```

**STOP-AND-PLAY GATE D — milestone end:**

Run the full check one more time:

```bash
git status              # clean
git tag --list 'm7*'    # includes m7-complete
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm smoke
pnpm --filter @matter/docs-tests test:visual
```

All green. **M7 is done.**

---

## Phase E — Push the branch and open a PR (only if branch policy allows)

The user has a working PR flow (PR #2 was M6). Follow the same pattern.

### Task E.1: Push and create the PR

**Files:** None — git/gh operations only

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/m7-vite-plus
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: M7 — Vite+ adoption (runtime + pkg mgr + vp migrate)" --body "$(cat <<'EOF'
## Summary
- Adopted Vite+ alpha to manage Node 22 runtime (`vp env`) and wrap pnpm 9.12 (`vp install`/`vp add`/`vp remove`).
- Bumped Vite 5→8 and Vitest 2→4.1+ (prerequisites for `vp migrate`).
- Ran `vp migrate` on `@lovo/matter`, `@lovo/matter-react`, `@lovo/matter-cli`, and `apps/playground`. Vitest imports now route through `vite-plus/test`; per-package configs consolidated into `vite.config.ts`.
- `apps/docs` (Next.js) and `apps/docs-tests` (Playwright) deliberately untouched.
- **Explicitly out of scope (split into M7.1–M7.4 for stop-and-play pacing):** tsup→tsdown, Turborepo→`vp run`, ESLint→Oxlint, Prettier→Oxfmt.

## Test plan
- [ ] `pnpm install --frozen-lockfile` succeeds with no lockfile diff
- [ ] `pnpm typecheck` green across all packages
- [ ] `pnpm lint` green
- [ ] `pnpm build` produces identical dist/ artifacts to pre-migration baseline
- [ ] `pnpm test` green
- [ ] `pnpm smoke` green (CLI end-to-end)
- [ ] `pnpm --filter @matter/docs-tests test:visual` green (Playwright)
- [ ] Both `vp install` and `pnpm install` produce identical lockfile output
- [ ] Manual: open `pnpm --filter @matter/docs dev`, walk every component page, all Tweakpane controls function

## Notes
Migration notes (timings, breaking-change findings, Phase decisions) preserved at `docs/superpowers/plans/2026-05-12-matter-m7-notes.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Return the PR URL to the user**

---

## Self-Review Notes (for the plan author / reviewer)

Run this checklist before handing off:

1. **Spec coverage:** This plan covers Phase A (runtime + pkg mgr) + Phase B (prereq bumps) + Phase C (`vp migrate`) + Phase D (verification) + Phase E (PR). It explicitly defers tsdown / Oxlint / Oxfmt / `vp run` to M7.1–M7.4. **Verify with the user that this scope split matches intent before executing.**

2. **Placeholder scan:**
   - "If `voidzero-dev/setup-vp` doesn't exist yet — skip" (Task A.3 step 5) is **conditional logic**, not a placeholder. Acceptable: the alpha-stage uncertainty is real and the fallback is concrete (keep pnpm in CI).
   - Version numbers in Tasks B.2 and B.3 are intentionally `from npm view` rather than hardcoded — Vite 8.x and Vitest 4.x are moving targets in alpha-adjacent toolchains. The steps require the engineer to fetch and substitute the current latest, which is concrete enough.
   - Task B.1 reads upstream migration guides and writes findings to `m7-baseline.md` — this is research-as-task, with a concrete artifact required at the end (a "Vite 5→8 breaking changes" section). Acceptable.

3. **Type consistency:** No new types or signatures introduced — this milestone is config-level only. N/A.

4. **Risk acknowledgement:** Vite+ alpha status is named in the header, in Task A.1 (install with alpha tag noted), and in Task A.3 step 5 (CI deferral). Phase D step 1 explicitly handles `vp lint` running Oxlint accidentally — covered.

5. **Pacing check:** Every phase ends at a stop-and-play gate. The user can halt after Phase A, Phase B, Phase C, or Phase D and still have a coherent intermediate state. ✅

6. **CLAUDE.md update:** Task D.4 updates both the milestone table and the Stack paragraph. ✅
