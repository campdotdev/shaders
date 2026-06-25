# MEMORY.md — Persistent preferences and decisions

Auto-loaded at session start. Read this alongside `CLAUDE.md` before doing anything.
Update this file when a new preference is established or an old one changes.

---

## Working style

### Phase gates (stop-and-play) — CRITICAL

Every phase ends at a runnable, observable point — something openable in a browser, clickable, feel-able. After each phase: stop, summarize the diff in conversation, and **wait for the user to run the dev server and react**. Do NOT plow into the next phase without explicit confirmation.

Default to many small phases (1–3 day execution units), not few large ones. Don't bundle "engine + binding + component + docs page" into one phase — break each layer out.

Surface "feel-decisions" early on rough prototypes (e.g., a shader's default intensity or color on a hardcoded demo BEFORE the prop API is polished).

### Shader co-write — CRITICAL

For shader files inside `registry/` (any `shader.tsx`), the **user writes the TSL code chunk-by-chunk**. The agent's job is to:
1. Describe what the chunk does and why
2. Explain any TSL or GPU concepts involved (uniforms, nodes, time, uv, smoothstep, etc.)
3. **NOT call `Edit` or `Write` on those files**

After each chunk the user pastes it in, runs the dev server, and reacts before the next chunk. This is both a learning exercise and a personal creative act — the shaders are meant to feel like co-authored work, not agent output.

Wrapper files (`component.tsx`, `mesh-gradient.tsx`, etc.) are fair game for direct edits. Only `shader.tsx` files trigger the co-write mode.

### Shader explanation level

The user is relatively new to shaders and wants Matter to double as a learning experience. When introducing GPU/TSL concepts (uniforms, uv, time, FBM, voronoi, SDF, smoothstep, render passes, vertex/fragment stages, PostProcessing), briefly explain what each thing is and why it matters. Don't assume baseline GPU knowledge. The gap is specifically the GPU side — React, TypeScript, and build tools don't need explanation.

### Pacing on non-shader work

For non-shader phases the agent can write files directly, but the same phase-gate rule applies: stop after each phase and wait for confirmation before continuing.

---

## Code conventions

### Props destructuring

Always destructure props at the function signature. Never access `props.X` inside the component body.

```tsx
// correct
function Foo({ intensity = 0.4, color = '#000' }: FooProps) { … }

// wrong
function Foo(props: FooProps) { const { intensity } = props … }
```

### Commit messages

Conventional Commits (`feat(scope):`, `fix(scope):`, `chore:`, `docs:`, `ci:`). Scope = package name without `@lovo/` (e.g., `feat(matter):`, `feat(matter-react):`, `fix(tooling):`). No Claude attribution in commit messages or PR descriptions.

### Branch workflow

Never push to `main` directly. Work on feature branches; user opens PRs via `gh pr create`. Don't autonomously push or open PRs unless the user explicitly asks.

---

## Command surface (post-M8)

Vite+ (`vp`) was removed in M8. Use plain pnpm:

```bash
pnpm build          # build all packages
pnpm typecheck      # tsc --noEmit across all packages
pnpm lint           # eslint on all packages
pnpm test           # vitest
pnpm format         # oxfmt
pnpm clean          # remove dist/, .turbo/, node_modules/
pnpm smoke          # end-to-end CLI smoke test

# Single-package watch:
pnpm --filter @lovo/matter dev
```

Plans written before M8 may still reference `vp run …` — translate those mentally to the pnpm equivalents above.

---

## Completed milestones (quick reference)

| Milestone | What | Tag / version |
|---|---|---|
| M0 | Repo bootstrap | `m0-complete` |
| M1 | `<LinearGradient>` vertical slice | `m1-complete` |
| M2 | `@lovo/matter-cli` | `m2-complete` |
| M3 | Other 5 v1 components | `m3-complete` |
| M4 | Docs site polish | `m4-complete` |
| M5 | Performance + testing + a11y | `m5-complete` |
| M6 | v0.1.0 publish | `m6-complete` / `v0.1.0` |
| M7 | Vite+ adoption (later reverted) | `m7-complete` |
| M9 | Drop pure TSL re-exports from `@lovo/matter` | `m9-complete` / `v0.2.0` |
| MAT-8 | MeshGradient full rebuild (noise rotation, domain warp, palette cycling, film grain primitive) | — |
| MAT-16 | Grain + Vignette overlay pipeline; `useOverlayPass`; PostProcessing in MatterScene | — |
| MAT-13 | Brand-aligned OKLCH palette; `/palette` ref page; all component defaults pivoted | `v0.3.0` |
| M8 | Vite+ removal; Oxlint → ESLint 9; ESLint backlog cleared | — |
| MAT-37 | Output dithering productized (#46): Bayer 8×8, scene-wide display-space output pass; dropped per-component `dither()` + scene-level gamut control from LinearGradient panel | — |

M7.1, M7.2 (tsdown, `vp run`) were cancelled when M8 reverted the Vite+ adoption.

---

## Open backlog items (near-term candidates)

From `docs/superpowers/ideas-backlog.md` — not commitments, just orientation:

**Infrastructure (smaller, no new components):**
- Atomic overlay reorder — eliminate the 1-frame flash when toggling `<Grain>`/`<Vignette>` order (microtask-batch `rebuildOutputNode`). Size S–M.
- Blend mode prop on overlay components (`'multiply' | 'screen' | 'overlay'` etc.)
- Promote `useColorUniform` to `@lovo/matter-react` (wait until `colorSpace` infra is designed)
- `colorSpace` prop across all Tier 1 components (OKLab/OKLCH GPU blending)

**New Tier 1 components:**
- `<RadialGradient>` — XS
- `<ConicGradient>` — S
- `<Plasma>` — S (demoscene FBM-driven chromatic noise)
- `<Halftone>` — M (overlay)
- `<ChromaticAberration>` — S (overlay)
- `<Glow>` / bloom — M (overlay)
- Cursor ripples — M

---

## Code style preferences

- **No comments or JSDoc unless asked.** The user adds comments and documentation themselves. Do not add JSDoc (`/** */`), inline explanatory comments, or `// ...` notes when writing or editing code. Only add a comment if the user explicitly requests it or the specific line contains non-obvious behaviour that would otherwise be invisible (e.g. a required workaround for a named gotcha in CLAUDE.md).
- **Avoid ESLint suppression comments.** Fix lint errors with clearer types, runtime guards, narrower scopes, or small refactors. Use `eslint-disable` comments only when the rule is genuinely wrong or the workaround would make the code less clear, and keep the comment as narrow as possible.
- **No double-underscore test helper names.** Prefer clear names like `resetReducedMotionForTests`; the `ForTests` suffix is enough signal. Do not add `__fooForTests`-style exports.

---

## Key gotchas (additions beyond CLAUDE.md)

- **`pnpm smoke`** runs the CLI end-to-end in a fresh `/tmp` project. Always run it after touching `packages/matter-cli/` or `registry/package.json`/`registry/registry.json`.
- **Registry wrapper vs shader split:** wrapper = props + defaults + forwards to shader; shader = TSL uniform plumbing + `useEffect` that builds material. Shader files are never written by the agent (co-write rule above).
- **`useOverlayPass` deps:** uniform value changes don't need to be deps (uniforms mutate in place). Structural changes — like a `mode` toggle that changes which branch of the transform runs — DO need to be deps (forces re-registration, which rebuilds the TSL graph).
- **`Vector2`/`Vector3` uniform stability:** always `useMemo(() => new VectorN(...), [])` with empty deps for the underlying instance. Write to it via `.set()` inside a `useEffect([prop])`. If you recreate the instance on every prop change the uniform node loses identity and the shader material recompiles on every keystroke.
