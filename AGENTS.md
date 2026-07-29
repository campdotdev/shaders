# AGENTS.md — Matter project guide

You are working on **Matter** — a React shader component library on WebGPU + Three.js TSL. This file orients any coding agent (Claude Code, Codex, Cursor, Gemini CLI, etc.) at the start of a session. Read it fully before doing anything else.

## Where to find things

| You need…                                 | Read…                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Full design — what we're building and why | `docs/superpowers/specs/2026-05-02-matter-design.md`                                     |
| Feature specs and implementation plans    | `docs/superpowers/specs/`, `docs/superpowers/plans/`                                     |

> **Note:** `docs/superpowers/` (specs and plans) is gitignored — it exists only on machines it's been synced to. On a fresh clone those paths are absent; this file plus git history are the portable orientation.

Milestone history lives in git tags and `docs/superpowers/plans/`. Don't trust any hardcoded status table — check the tags.

## Project shape (30-second version)

- **Three-tier model**: Tier 1 = polished components (`<LinearGradient>` etc., delivered via shadcn-style CLI copy-paste from `registry/`); Tier 2 = TSL primitives in the engine package (`fractalNoise`, `voronoi`, etc.); Tier 3 = recipes (TSL snippets in the docs site).
- **Three packages**: `@lovo/matter` (engine, framework-agnostic), `@lovo/matter-react` (React binding), `@lovo/matter-cli` (copy-paste delivery).
- **Two rendering modes** (no auto-detection of `@react-three/fiber`): Mode 1 — every Tier 1 component is bare and requires an explicit `<ShaderScene>` wrap; composition is stacking children in one scene. Mode 2 — `useShaderMaterial` inside the user's own r3f `<Canvas>`.

For architecture, public APIs, the component catalog, and the animation/signal protocol — read the spec. Decision history is in the spec's Appendix A.

## Git and PR workflow

- **Never push directly to `main`.** Every change — including tiny CI tweaks and doc edits — goes through a PR branch: branch → commit → push → open PR. If a commit lands on local `main` by accident, move it to a branch and reset `main` to `origin/main` before pushing.
- **When finishing a branch, always push and open a PR.** Never merge locally. Don't ask which integration option to use.
- **No AI attribution.** Do not add "Generated with Claude Code" (or equivalent) trailers or `Co-Authored-By` AI footers to commits or PR bodies.
- **PR bodies**: concise and why-led. 1–2 sentences of motivation under `## Why`, then a short list of changes framed by why each matters. No "Test plan" section, no "Follow-ups" section, no links to internal planning artifacts (`.planning/`, `docs/superpowers/plans/`, memory files). Group by concept, not by commit. The prose should sound like a person, not generated copy.
- **Format PR bodies with real markdown headings**, not walls of paragraph text. `## Why` for the motivation, `## What changes` with a `###` per concept beneath it when there are multiple concepts, `## Known limitations` when there are any. Bullets under a heading where the items are genuinely a list. A body a reviewer has to read end-to-end to find the part they care about is too flat, however good the prose is.
- **Run user-facing prose through the humanizer skill** (`~/.agents/skills/humanizer`). PR bodies, changelog entries, and release notes get a humanizer pass before opening the PR / publishing.
- **Commit messages**: Conventional Commits (`feat(scope): …`, `fix(scope): …`, `chore: …`, `docs: …`, `ci: …`). Scope is the package name without the `@lovo/` prefix.

## Shader development process

These rules exist because Matter doubles as a shader-learning project for its author. The author is fluent in React/TypeScript/build tooling; the gap is GPU concepts (uniforms, sampler space, noise types, domain warping, smoothstep, render passes). Spend explanation budget there.

1. **Rebuilds go step by step.** When improving or rebuilding a shader component, translate the design into TSL incrementally, explaining each TSL/GPU concept as it appears. Don't silently refactor existing TSL.
2. **Target structure is the Aurora split**: `registry/<name>/<name>.tsx` (component wrapper — props, uniforms, mesh lifecycle, ~80 lines) plus `registry/<name>/shader.tsx` (the TSL shader function, isolated and reusable).
3. **Many small phases with hard gates.** Break rebuilds into bite-sized, runnable steps. Every phase ends at something openable in the docs site or a dev playground. After each phase: stop, show the diff in chat, explain the new TSL concepts (treat it as a 3-minute mini-tutorial), and wait for the author to run the dev server and react before starting the next phase. This overrides any "continuous execution" default your harness has. "Compiled cleanly" is not approval — the visual has to be felt.
4. **Ask early who types the code.** The historical default is co-writing: the agent describes a small chunk (concept + exact code + where it goes) and the author applies it by hand. Recent sessions shifted toward "agent writes the code AND a full explanation of every line; author validates at the dev-server gate." Ask at the start of each rebuild which mode is wanted. Either way, phase gates stay.
5. **For feel-features, design-conversation first.** Bolting a prop onto a shader at a gate without a brainstorm has failed before ("that looks terrible"). Aesthetic changes (variance, patchiness, vibrancy layers) get a short design discussion before code.

## Code conventions

- **Destructure props in component signatures.** Never `props.X` access. Wrappers set defaults inline: `function MeshGradient({ speed = 2 }: MeshGradientProps)`. Order destructured fields to match the interface declaration.
- **Clear names over abbreviations.** No `u`, `cfg`, `ctx`, `cb`. Exceptions: conventional loop counters and math/shader locals that mirror the math (`x`, `y`).
- **TypeScript**: `import type` for type-only imports.
- **TDD where applicable**: tests-first for Tier 2 primitives and CLI logic. For shader visuals, the "test" is a docs demo + Playwright visual regression — don't try to unit test "does this gradient look right" or mock the GPU.
- **No emojis** in code or commit messages.
- **JSDoc on every user-facing prop.** All registry component props — the wrapper `*Props` and the `*ShaderProps` mirror, plus nested types like `WaveLine`/`ColorStop` — carry JSDoc: what the prop controls, 0/1 semantics for normalized props, units, and the default in prose (wrapper only; the mirror drops "Defaults to …"). Every `AnimatableProp<T>` prop ends its comment with "Accepts a static value or an animation signal."; plain props don't.
- **Comment style (repo-wide).** Comments explain the code, not the stack — the reader knows React/TypeScript but not this codebase or GPU work. Every substantive file gets: a 2–5 line file-top summary (what the file is, why it exists, how it connects to its neighbors); dashed-divider section titles (`// ----` rule + short plain-language title) following the pixel's journey in shaders or lifecycle in infra files; TSL math worked through, not labeled (inputs, what the expression computes, behavior at 0/1/extremes, tricks named — aspect correction, `oneMinus()` dial flips, epsilons); the job of each non-trivial effect/memo, never the mechanism of the hook itself; a short plain-words gloss the first time a GPU term appears in a file (files stand alone — registry files get copy-pasted out via the CLI); and constants documented with units and what turning them up/down does. Model files: `registry/wave-lines/shader.tsx`, `registry/vignette/shader.tsx`. Never comment obvious code, never write a claim you haven't verified against the code, and reference AGENTS.md gotchas by name, not number (numbers drift).
- **Prop names use everyday words, not GPU jargon.** Prefer `waviness` over `turbulence`, `coverage`/`radius` over `falloff`, `balance` over `bias`. When two components share a concept, they share the name (e.g. `center`).
- **YAGNI hard.** Don't add features beyond the current task. No inert props for API symmetry (e.g. `colorSpace` was deliberately NOT added to non-interpolating components like grain/aurora).

## Design rules

**Gradients** (component defaults, demo palettes, any web gradient):

- Analogous hues — stops within ~60° on the wheel for linear (2–3 stops), within ~120° for mesh (4–5 stops).
- Never let a 2-stop gradient pass through gray (complementary pairs desaturate at the midpoint).
- Create depth with lightness, not hue: ≥0.10 L delta in OKLCH between stops.
- Subtle for backgrounds, bold for accents; check text contrast at the lightest AND darkest points.

**Demo color controls** (docs demo panels): use `<ColorInput>` from `apps/docs/src/components/controls/`. It edits in OKLCH and always writes `oklch()` strings, which is what keeps wide-gamut input working — `parseColorString` accepts only hex, `oklch()`, and `oklab()`, and a picker that emits `rgb()`/`hsl()` throws. Initial values in `params.ts` should be `oklch()` strings. Pure black is `oklch(0 0 0)`. The two `/dev` playgrounds still use Tweakpane directly; this guidance doesn't apply there.

## Environment and build gotchas

- **Node 22, exactly.** The docs production build (`next build`, static export) **silently fails on Node 23** — exits 0, writes no `out/`, which then breaks pagefind and `pnpm snap`. Fix is environmental (run the pinned Node 22), not a config change. `.node-version` = 22.22.2 is the source of truth; `.nvmrc` = 22 is the loose duplicate fnm actually honors.
- **The docs site consumes built `dist`, not source**, for `@lovo/matter` and `@lovo/matter-react` (`@matter/registry` is the exception — raw `.tsx` via `transpilePackages`). After editing engine/binding source: `pnpm --filter @lovo/matter build` AND restart the docs dev server, or a correct fix looks like a no-op. Before re-debugging a "fix that didn't work," check `dist` mtime vs `src`.
- **CI runs more than package-scoped checks.** Three traps:
  1. `pnpm install --frozen-lockfile` runs first in every job — any `package.json` dep change must ship with the updated `pnpm-lock.yaml` or every job dies at install (`ERR_PNPM_OUTDATED_LOCKFILE` masquerading as "everything failing").
  2. CI runs root `pnpm format:check` (whole-repo Prettier), not just lint. The import-sort plugin orders react/external imports before `@lovo/*`/`@matter/*`. Run Prettier on changed files before committing.
  3. Visual regression screenshots the canvas itself (`page.locator('canvas').first()`), not the full page or the `[data-shader-demo]` container — a change that resizes or repositions the canvas invalidates baselines; a change confined to the control panel's own styling does not. That wasn't always true: before the panel moved into a sidebar outside `[data-shader-demo]` it was absolutely positioned inside the canvas's bounding box, so any panel change showed up in the shot too. It no longer does, which means the panel can be restyled freely without regenerating anything — but `.demo-layout`'s grid columns and padding are CSS that sizes the canvas, so layout changes there still invalidate baselines, and `DemoPoster`'s poster image sits inside `[data-shader-demo]` but outside the canvas so it's never captured either way. Regenerate with `pnpm snap` (needs Docker for the Linux baselines, Node 22) only when the canvas itself changes size or position.
- **npm publish uses OIDC trusted publishing**, and `pnpm publish` always delegates the actual PUT to whatever `npm` is on PATH. Working combo: pnpm 10 + `npm install -g npm@11` (npm 10 has no OIDC → ENEEDAUTH; npm 12 rejects pnpm's forwarded `--git-checks` → EUNKNOWNCONFIG; a `registry-url` in setup-node writes an empty-token authline that skips OIDC → anonymous PUT masked as E404). E404/ENEEDAUTH on publish = auth-chain failure, not a missing package.
- **`apps/docs/tsconfig.json` uses a relative `extends` on purpose** (`../../tooling/tsconfig/base.json`, not the `@matter/tsconfig` package form every other workspace uses). Fallow's resolver drops `paths` when `extends` goes through a workspace package. Don't "normalize" it.

## Technical gotchas (hard-won — read before touching TSL or the build)

1. **`${configDir}` substitution is required in shared tsconfigs** — `tooling/tsconfig/library.json` uses `${configDir}/dist` etc. Don't add `rootDir` back; tsup's DTS build uses `load-tsconfig`, which doesn't substitute `${configDir}`.
2. **`incremental: true` + `tsc --noEmit` requires `tsBuildInfoFile`** — already set in `library.json` (TS5074 means it got lost).
3. **`turbo` ≠ `turbopack`** — Turborepo orchestrates the monorepo; Turbopack is Next's bundler (docs only).
4. **TSL `colorNode` types reject `ShaderNodeObject<unknown>`** — use `Node | ShaderNodeObject<Node>`.
5. **`uniform(vec2(...))` loses the Vector2 mutator API** — use `uniform(new Vector2(...))` when you need `.set()`.
6. **`setClearColor` only accepts `Color` in three 0.170+** — convert via `new Color(...)`.
7. **Vitest exits 1 with no test files** — `passWithNoTests: true` in per-package configs.
8. **`@matter/registry` + `transpilePackages` is required** for the docs site to import raw `.tsx` from a workspace dep.
9. **`three/webgpu` references `self` at module load — cannot SSR.** CPU color math has a three-free door for this: import it from `@lovo/matter/color`, not the root `@lovo/matter` entry — a `no-restricted-imports` rule scoped to `apps/docs/**` rejects the root specifier for those names. `next/dynamic` with `{ ssr: false }` is still correct for anything that genuinely reaches the renderer or `@lovo/matter-react`'s barrel, which is why the color picker still uses it.
10. **`tweakpane@4` ships a broken `@tweakpane/core` reference** — add published `@tweakpane/core` 2.x as a devDep for typecheck.
11. **Consume vec-typed `uniform(...)` as an argument, not a chained receiver, in TSL math.** `uv().sub(cursorUniform)` works; chaining methods off a raw vec2/vec3 uniform node silently produces wrong GPU values despite typechecking. Build expressions from `uv()`/`vec2(...)` and pass vec uniforms as args. Scalar (float) uniforms are safe as chained receivers — wave-lines chains them throughout and seven visual gates validated it.
12. **three ships two standalone bundles** (`three.module.js`, `three.webgpu.js`); importing both duplicates three core (`Cannot read properties of undefined (reading 'usedTimes')` on dispose). Alias all three subpaths to the webgpu bundle (see `apps/docs/next.config.ts`).
13. **Hooks owning long-lived disposables must be Strict-Mode-safe.** Collapse create/attach/dispose into one `useEffect`; see `useCursor.ts` for the canonical pattern.
14. **Never rebuild a `NodeMaterial` on prop change — push values through stable `uniform(...)` nodes.** Hold live values in a stable `Vector2`/`Vector3` (`useMemo([])`), wrap in a stable `uniform(vec)`, push prop → `vec.set(...)` in a light effect; the material effect depends only on stable references and runs once per mount. Known exceptions: `LinearGradient`, `SimplexNoise`, and `WaveLines` rebuild on `colors`/`stops` because `colorRamp` bakes literals — acceptable until a feature drives colors at 60Hz, at which point the fix is widening `colorRamp` to accept uniform nodes, NOT patching the components.
15. **`useShaderMaterial(build)` rebuilds whenever `build`'s reference changes — by design.** Callers must memoize the build callback (or hoist it). A test asserts this; don't remove the dep.
16. **Arrays/tuples passed as props need a stable proxy in effect deps** — stringify (`colors.join('|')`) or route fixed-size tuples through a `Vector2`/`Vector3` uniform (see vignette's `center`). Never list raw arrays in a heavy effect's deps.
17. **Output dithering is scene-wide, in display space.** `ShaderScene` builds `outputNode = dither(renderOutput(composed))` with `outputColorTransform = false`. Never add per-component `dither()` in a `colorNode` — double-dithers and runs in linear space. The exported `dither()` primitive is for Mode 2 only. Gamut, like dither, is scene-level — keep both off per-component panels.
18. **Light-emitting transparent layers need `material.premultipliedAlpha = true`.** Any component whose colorNode emits light-contribution rgb with coverage alpha (aurora-style) double-multiplies by alpha under default NormalBlending, quadratically dimming soft wisps.
19. **"Shader looks cropped/compressed/zoomed" → check `renderer.getSize()` vs canvas client size FIRST**, not uv/camera math. The renderer once stuck at the 300×150 canvas default (logical-size guard + ResizeObserver fixed it). Headless Playwright falls back to WebGL2 here (`navigator.gpu` truthy but device init fails).
20. **Wide-gamut P3 output reaches into renderer internals** (three 0.170 has no native WebGPU P3 path): we register the ColorSpaces addon via `ColorManagement.define` and manually re-`configure()` the `GPUCanvasContext` in `packages/matter/src/runtime/create-renderer/gamut.ts`. A future three bump should delete the manual reconfigure. P3 output can't be pixel-asserted in headless Playwright — decode is proven by `parseColorString` unit tests; widening is validated by eye on a P3 display. `hsl`/`hsv` color spaces clamp to sRGB first (negative-channel `pow()` breaks WGSL const-eval otherwise).
21. **Colors commit on release in the demo panels, numbers commit live.** `LinearGradient`, `SimplexNoise`, and `WaveLines` rebuild their `NodeMaterial` when colors change (see the colorRamp gotcha), so a continuously-firing color drag would recompile the shader every frame. `ColorInput` holds a draft and writes to the store on pointer release; `SliderInput` writes on every change because numeric props ride stable `uniform(...)` nodes.
22. **Subscribing to a container in the demo control store (docs demo panels) re-renders everything under it.** `writeAtPath` rebuilds every object and array along the written path, so a component that subscribes to the root params object or to a list's array re-renders on every write anywhere inside it — and the control components are deliberately unmemoized, so that cascades. This bit three separate times on this branch before the pattern below stuck. Subscribe to a leaf, or to a stable primitive like a list's `length`, and read containers non-reactively at event time via `useControlStore()` (see `ControlPanel`'s copy buttons and `ListInput`'s add/remove).

## Color system (shipped — how the pieces relate)

- **`colorSpace` prop** (interpolation space) on interpolating components only: `LinearGradient`, `MeshGradient`, `SimplexNoise` (via `colorRamp`), `Vignette` (via `mixColor`), `WaveLines` (gradient lines via `colorRamp`). Default `oklab` on components; primitives default `linear`. Lives in `packages/matter/src/primitives/color-space/`.
- **`gamut` prop** on `<ShaderScene>`: `'auto' | 'srgb' | 'p3'`, default `auto` (detects via `(color-gamut: p3)`, re-resolves on monitor change).
- **Orthogonal concerns**: `colorSpace` = mixing math; `gamut` = output framebuffer; wide-gamut **input** is just the decode (`oklch()`/`oklab()` strings through `parseColor` → unclamped linear-sRGB) and needs zero mixing props. Additive-light components that don't interpolate (aurora) get no mixing props — but they accept oklch input. `WaveLines` interpolates when a line's color is a gradient, so it takes `colorSpace` even though its lines are additive.

## Open threads (as of 2026-07-25)

- **Aurora organic variance** — two deferred seeds from MAT-46: horizon variance (curtain lower border too straight) and per-ribbon vibrancy layers. MAT-48 rebuilt the shader since (triangle-noise fbm, depth-indexed ramp), so re-evaluate both against the current `registry/aurora/shader.tsx` before acting. Needs a design brainstorm first, per shader rule 5 above.
- **`colorRamp` uniform-node widening** — deferred until something drives ramp colors at interactive frequency (gotcha 14). Measured on this branch: the demo panels commit colors on release rather than continuously (gotcha 21), and on `wave-lines` — 16 baked colors, the library's largest ramp — releasing a color drag still produces a brief but perceptible stutter, one material rebuild per gesture. Acceptable; sixty rebuilds a second would not have been. Commit-on-release is load-bearing for that, so the widening stays deferred, now with a real data point instead of a guess.
- **Aurora `horizon`/`sky` background colors** — arguably shouldn't exist (background is the user's job); removing is a breaking redesign, needs its own ticket.

## Out of scope (firm — don't drift)

Explicitly v2+ per the spec, even if easy: image/video filters, particle systems, 3D objects/materials, text effects, cursor effects, Vue/Svelte bindings, hosted registry endpoint, audio-reactive primitives, built-in animation library (Matter accepts MotionValue-shaped signals), CSS custom-property theming, per-component material hooks.

## Deployment

The docs site deploys to a platform chosen by the author at deployment time. Don't recommend a specific hosting platform — ask.

## Agent-specific notes

- **Claude Code**: `CLAUDE.md` imports this file. Machine-local session memory lives outside the repo and is NOT synced across machines — this file is the portable source of truth; keep it current when durable preferences or gotchas emerge.
- **Skill-capable agents** (Claude Code, Codex, OpenCode): the superpowers skill set (brainstorming, systematic-debugging, TDD, writing-plans) is used heavily here — install it per your harness. Agents without skill support: the shader process and workflow rules above are the load-bearing subset; follow them directly.
