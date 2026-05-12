# CLAUDE.md — Matter project orientation

You are working on **Matter** — a React shader component library on WebGPU + Three.js TSL. This file orients you at the start of every new session. **Read it fully before doing anything else.**

The repository is currently at `/Users/hunter.garrett/Documents/_personal/mattermix/` (the directory is named `mattermix/`; rename to `matter/` is a deferred cosmetic chore — don't do it autonomously, the npm packages are `@lovo/matter*` regardless).

## Where to find things

| You need…                                          | Read…                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full design — what we're building and why          | `docs/superpowers/specs/2026-05-02-matter-design.md`                                                                                             |
| Implementation plans (one per milestone)           | `docs/superpowers/plans/`                                                                                                                        |
| Memory of decisions, gotchas, and user preferences | Already auto-loaded via `MEMORY.md` — review what's there before asking the user about anything                                                  |
| Current code                                       | `packages/matter/`, `packages/matter-react/`, `packages/matter-cli/` (engine, React binding, CLI), `tooling/eslint-config/`, `tooling/tsconfig/` |
| Future Tier 1 components (none yet)                | `registry/` (created in Milestone 1)                                                                                                             |
| Future docs site                                   | `apps/docs/` (created in Milestone 1.7+)                                                                                                         |

**At session start**, run these to get oriented:

```bash
git log --oneline | head -20      # what's been done recently
git tag                            # which milestones are tagged complete
git status                         # are there uncommitted changes
ls docs/superpowers/plans/         # which plans exist
```

## Project shape (30-second version)

- **Three-tier model**: Tier 1 = polished components (`<LinearGradient>` etc., delivered via shadcn-style CLI copy-paste from `registry/`); Tier 2 = TSL primitives in the engine package (`fbm`, `voronoi`, `cursorRipple`, etc.); Tier 3 = recipes (TSL snippets in the docs site).
- **Three packages**: `@lovo/matter` (engine, framework-agnostic), `@lovo/matter-react` (React binding), `@lovo/matter-cli` (copy-paste delivery).
- **Three rendering modes** (no auto-detection of `@react-three/fiber`): Mode 1 drop-in (`<LinearGradient />` auto-creates a canvas), Mode 2 shared `<MatterScene>` (one canvas, multiple effects), Mode 3 use `useShaderMaterial` directly inside user's own r3f `<Canvas>`.
- **Stack**: TypeScript 5 strict mode, pnpm 9 workspaces, Turborepo (orchestration; **NOT Turbopack**), tsup (bundling, ESM+CJS+types), ESLint 9 flat config, Prettier 3, Vitest (unit tests), Next.js 15 (docs site, lives at `apps/docs/`), Tweakpane (interactive shader playground panel on the docs site). Visual regression: Playwright against the docs site routes (M5).
  - **Note (M1 deviation):** the original plan called for Storybook 10 + Vite. We ripped Storybook out — see [Storybook → Tweakpane pivot memory](../../.claude/projects/-Users-hunter-garrett-Documents--personal-mattermix/memory/project_matter_storybook_pivot.md). Don't reintroduce Storybook in v1; the docs page is the demo surface.

For full architecture, public APIs, the v1 catalog of six components, animation/signal protocol, and the docs site design — read the spec.

## Milestone status

| #   | Milestone                                      | Status      | Tag           |
| --- | ---------------------------------------------- | ----------- | ------------- |
| 0   | Repo bootstrap                                 | ✅ Complete | `m0-complete` |
| 1   | Vertical slice — `<LinearGradient>` end-to-end | ✅ Complete | `m1-complete` |
| 2   | `@lovo/matter-cli`                             | ✅ Complete | `m2-complete` |
| 3   | The other 5 v1 components                      | ✅ Complete | `m3-complete` |
| 4   | Docs site polish (light scope)                 | ✅ Complete | `m4-complete` |
| 5   | Performance + testing + a11y                   | ✅ Complete | `m5-complete` |
| 6   | v0.1.0 publish                                 | ✅ Complete | `m6-complete` |
| 7   | Vite Plus toolchain migration                  | Pending     | —             |

Each milestone is its own session and its own implementation plan. Don't try to do multiple milestones in one session.

## How to work on this project

### Starting a milestone

1. Confirm current state: read this file, check `MEMORY.md`, check `git log` and `git status`.
2. If the next milestone has no plan yet (`docs/superpowers/plans/`), invoke `superpowers:writing-plans` to create one. Reference the design spec; produce a granular plan with bite-sized tasks (1–3 days each).
3. The user prefers **subagent-driven execution** (`superpowers:subagent-driven-development`) for milestone work — fresh subagent per task, two-stage review (spec compliance, then code quality).

### User's pacing preference (CRITICAL — do not ignore)

The user wants **many small phases (1–3 day execution units) with explicit "stop and play" validation gates**. They learn by running things and feeling them. Specific guidance:

- Default to many small phases, not few large ones.
- Every phase ends at a runnable, observable point — something openable in a browser, clickable, feel-able.
- Surface "feel-decisions" early on rough prototypes (e.g., cursor smoothing in M1.6 happens on a hardcoded shader, BEFORE LinearGradient has a polished prop API).
- Don't bundle "engine + binding + component + docs page" into one phase. Break each layer out.
- When proposing a roadmap, explicitly name the validation/learning beat at the end of each phase.

This is captured in `feedback_pacing.md` in memory — but it's important enough to repeat here.

### User's shader experience level

The user is **relatively new to shaders** and wants Matter to double as a learning experience. When introducing shader/GPU concepts (TSL, uniforms, attributes, FBM, voronoi, SDF, render passes, vertex/fragment stages), briefly explain what they are and why they matter — don't assume baseline GPU knowledge. Avoid over-explaining things they already know (React, TypeScript, build tools — the gap is specifically the GPU side).

## Common commands

**On runtime + package manager (post-M7):** Vite+ wraps pnpm. You can call either surface — they produce identical results. The Vite+ surface is `vp install` (acts as both `pnpm install` and `pnpm add`, e.g., `vp install -D <pkg> -w` to add a workspace-root devDep) plus `vp remove` (aliases: `rm`, `un`, `uninstall`) for removal. The pnpm surface (`pnpm install` / `pnpm add` / `pnpm remove`) continues to work identically — `packageManager: pnpm@9.12.0` is locked either way. Vite+ also manages the project's Node 22 runtime via `vp env`; the project's `.node-version` (22.22.2) is the source of truth.

```bash
# At repo root:
pnpm install                              # install/restore everything
pnpm build                                # build all packages (tsup, ~5s cold, instant from cache)
pnpm typecheck                            # tsc --noEmit on all packages
pnpm lint                                 # eslint on all packages
pnpm clean                                # remove all dist/, .turbo/, node_modules/
pnpm format                               # prettier write

# Watch mode for a single package:
pnpm --filter @lovo/matter dev            # tsup --watch

# End-to-end smoke test the CLI in a fresh /tmp project:
pnpm smoke
```

## Gotchas to remember (from M0 + M1 lessons)

1. **`${configDir}` substitution is required in shared tsconfigs** — `tooling/tsconfig/library.json` uses `${configDir}/dist`, `${configDir}/src`, etc. Without this, paths resolve relative to the parent file's directory, not the consuming package's, causing TS6059. Don't add `rootDir` back to library.json — tsup's DTS build uses `load-tsconfig` which doesn't substitute `${configDir}`, so `rootDir` must be inferred from `include` instead.
2. **`incremental: true` + `tsc --noEmit` requires `tsBuildInfoFile`** — already set in `library.json`. If you ever see TS5074, this is why.
3. **Root `package.json` lacks `"type": "module"`** — causes a harmless `MODULE_TYPELESS_PACKAGE_JSON` warning when ESLint runs. Cosmetic only. Fix if it ever becomes annoying.
4. **`turbo` ≠ `turbopack`** — Turborepo is the monorepo orchestrator (what `turbo.json` configures); Turbopack is Next.js's bundler (used in `apps/docs/` only, not in the published packages, which use tsup).
5. **TSL `colorNode` types reject `ShaderNodeObject<unknown>`** — three's types constrain the generic to `extends Node`. Use `Node | ShaderNodeObject<Node>` (see `colorRamp`/`useShaderMaterial`).
6. **`uniform(vec2(...))` loses the Vector2 mutator API** — TSL's `vec2(...)` returns a TSL Node, so `uniform(vec2(...)).value` is typed as Node, no `.set()`. Use `uniform(new Vector2(...))` when you need to mutate the value imperatively.
7. **`setClearColor`'s types only accept `Color` in 0.170+** — convert `number | string` via `new Color(...)` before passing.
8. **Vitest 2.x exits 1 when no test files are found** — set `passWithNoTests: true` in the per-package `vitest.config.ts` so `pnpm test` stays green for packages that haven't grown tests yet.
9. **`@matter/registry` workspace package + `transpilePackages` is required for the docs site** — Next.js refuses to import raw `.tsx` from a workspace dep without `transpilePackages: ['@lovo/matter', '@lovo/matter-react', '@matter/registry']` in `next.config.ts`.
10. **`three/webgpu` references `self` at module load** — it cannot SSR. In Next docs pages that render a Matter component, wrap the import in `next/dynamic` with `{ ssr: false }`.
11. **`tweakpane@4.0.5` ships a broken `@tweakpane/core` package.json reference** — its types pull from `@tweakpane/core` but the path in `dependencies` is the workspace-relative `../core` from tweakpane's own monorepo. Add `@tweakpane/core` (the published 2.x version) as a devDep to fix the typecheck. Runtime is unaffected.
12. **Consume `uniform(...)` as an _argument_, not a chained receiver, in TSL math.** `uv().sub(cursorUniform)` works; `cursorUniform.sub(vec2(0.5, 0.5)).mul(...).dot(...)` silently produces wrong values on the GPU even though it typechecks. The chain methods on raw uniform nodes don't propagate the value through the pipeline. The rule of thumb: build TSL expressions starting from `uv()` / `vec2(...)` / etc. and pass uniforms as args to those chains.
13. **`three` ships TWO standalone bundles (`three.module.js` and `three.webgpu.js`) and importing both creates two copies of three core.** Symptom: `Cannot read properties of undefined (reading 'usedTimes')` on `material.dispose()`. Fix in Next: webpack alias all three subpaths to the unified webgpu bundle (see `apps/docs/next.config.ts`). For other bundlers, force a single resolved path the same way.
14. **Hooks that own a long-lived disposable (CursorInput, scheduler clients, etc.) must be Strict-Mode-safe.** React 19 mounts effects → cleans up → mounts again in dev. The naive pattern `useState(() => new X())` + `useEffect(() => () => x.dispose(), [x])` disposes the singleton during pseudo-unmount, leaving you with a permanently-dead instance. Pattern that survives: collapse lifecycle into one `useEffect` that creates a fresh instance, attaches it, returns a cleanup that disposes it; expose the current instance via `useState`. Each Strict Mode cycle creates+destroys cleanly. See `useCursor.ts` for the canonical implementation.

## Conventions

- **Commit messages**: Conventional Commits (`feat(scope): …`, `fix(scope): …`, `chore: …`, `docs: …`, `ci: …`). Scope is the package name without the `@lovo/` prefix (e.g., `feat(matter):`, `feat(matter-react):`, `fix(tooling):`).
- **Branch**: `main` only for now. PR branches when GitHub remote is configured.
- **TDD where applicable**: For Tier 2 primitives and CLI logic, write tests first (Vitest). For Tier 1 components and shader visuals, "tests" are docs-page demos (with Tweakpane controls) + Playwright visual regression in M5 — there is no meaningful unit test for "does this gradient look right." Don't try to mock the GPU.
- **TypeScript**: strict mode, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`. Use `import type` for type-only imports (the lint rule enforces this).
- **No emojis in code or commit messages** unless the user explicitly requests them.
- **Don't add features beyond what the current task or plan specifies.** YAGNI hard. If you find yourself thinking "while I'm here, I'll also add…", stop.

## Out of scope (firm — don't drift)

The following are explicitly v2+ per the spec. Do not implement them in v1, even if it seems easy:

- Image/video filter components, particle systems, 3D objects/materials, post-processing effects, text effects, cursor effects (the ones from Q2 of brainstorming)
- Vue and Svelte bindings (architecture is ready; ship when there's actual user demand)
- Hosted registry endpoint (CLI fetches from GitHub raw URLs in v1)
- Audio-reactive primitives
- Built-in animation/spring/timeline library (Matter accepts MotionValue-shaped signals; users bring Motion or any compatible library)
- CSS custom property theming API
- Per-component hooks (`useLinearGradientMaterial`, etc.) — only `useShaderMaterial` is needed for r3f integration in v1

## Deployment

The docs site (when it exists in M1.7+/M4) deploys to a platform chosen by the user at deployment time per their deployment policies. **Don't recommend a specific personal hosting platform.** Ask the user what they want.

## Reference: original brainstorming session

The full Q&A that produced the spec lived in a single session on 2026-05-01 / 2026-05-02. That conversation is not retrievable. The decisions log is preserved as Appendix A of the spec. If you ever wonder "why did we choose X over Y?", check the spec's Appendix A first; if it's not there, ask the user.
