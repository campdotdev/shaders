# Example Color Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Matter's brand-aligned example color palette. A single TS module under `apps/docs/src/lib/palette.ts` exposes brand foundation scales (gray + lime, full 12 steps each) and a slim accent palette (amber/blue/violet/pink × dark/mid/light). All seven existing registry components have their default colors rewritten to pull from this palette. A permanent reference page lives at `/palette`. Visual regression baselines are regenerated for every affected component.

**Architecture:** Five phases, each ending at a runnable, observable stop-and-play beat. Phase 1 lays down the palette module + reference page (no behavior change to any shipped component). Phases 2-4 rewrite defaults one component family at a time (Aurora, then gradient family, then noise family + monochrome). Phase 5 closes out with lint/typecheck/visual baseline sweep, changesets, and backlog cleanup. Branch: `hunter/mat-13-set-a-side-wide-color-palette` (already checked out). Design spec: `docs/superpowers/specs/2026-05-30-example-palette-design.md`.

**Tech Stack:** TypeScript 5 strict, Next.js 15 docs route + React for the reference page, `culori` (devDep, one-shot OKLCH→hex conversion script), `@matter/registry` workspace package (defaults edited in wrappers, NOT in `shader.tsx` files), Playwright (visual baselines regenerated in Phase 5), `changesets` for version bumps.

**Critical user preferences to respect:**
- **Phase gates:** after each phase, stop, summarize the diff in conversation, and wait for the user to run the dev server and react. Do NOT plow into the next phase.
- **vp surface:** prefer `vp` commands (`vp run dev:docs`, `vp lint`, `vp run typecheck`) over their pnpm equivalents.
- **Destructure props at the function signature** (never `props.X` access).
- **No Claude attribution** in commits or PRs.
- **Shader files are off-limits to Edit/Write.** All registry edits in this plan touch wrapper files only (`aurora/aurora.tsx`, `mesh-gradient/mesh-gradient.tsx`, `linear-gradient.tsx`, etc.) — never `shader.tsx` siblings.

---

## File Structure

**Created:**
- `apps/docs/src/lib/palette.ts` — the canonical palette module. Exports brand foundation + accent palette as named TS constants.
- `apps/docs/src/lib/palette.gen.ts` — one-shot Node script (run via `tsx`) that converts OKLCH definitions to sRGB hex via `culori`. Output is hand-inlined into `palette.ts`; the gen script is committed for reproducibility.
- `apps/docs/src/app/palette/page.tsx` — permanent reference page at `/palette`. Replaces and supersedes `/dev/palette`.
- `apps/docs/src/app/palette/PaletteView.tsx` — client-only view component (the `oklch()` rendering happens in CSS but the page uses `'use client'` to match the existing dev-page pattern).
- `.changeset/<random>.md` — minor bump for `@matter/registry` (default color changes ship to anyone who refreshes from the CLI).

**Modified:**
- `registry/aurora/aurora.tsx` — `DEFAULT_LAYERS` (4 hex), `horizonColor`, `skyColor` defaults shift to palette picks.
- `registry/linear-gradient.tsx` — `DEFAULT_COLORS` (2 hex).
- `registry/mesh-gradient/mesh-gradient.tsx` — `DEFAULT_PALETTE_A`, `DEFAULT_PALETTE_B` (8 hex total).
- `registry/dot-field.tsx` — `DEFAULTS.color`.
- `registry/noise-field.tsx` — `DEFAULT_COLORS`.
- `registry/waves.tsx` — `DEFAULTS.color`.
- `registry/vignette/vignette.tsx` — `color` default (and confirm alignment with brand black).
- `apps/docs/src/app/components/aurora/page.tsx` — initial Tweakpane state hex constants.
- `apps/docs/src/app/components/linear-gradient/page.tsx` — `{ default: ['#ff7b72', '#7b9cff'] }` initial value.
- `apps/docs/src/app/components/mesh-gradient/page.tsx` — initial Tweakpane state hex constants (a0..a3, b0..b3).
- `apps/docs/src/app/components/noise-field/page.tsx` — initial Tweakpane state hex constants.
- `apps/docs/src/app/components/waves/page.tsx` — initial Tweakpane state hex constant.
- `apps/docs/src/content/nav.config.ts` — add `{ kind: 'link', label: 'Palette', url: '/palette' }` to the Overview group.
- `apps/docs/package.json` — add `culori` as devDep (one-shot use by `palette.gen.ts`).
- `apps/docs-tests/visual/aurora.spec.ts-snapshots/aurora-default.png` — re-baselined in Phase 5.
- `apps/docs-tests/visual/dot-field.spec.ts-snapshots/*.png` — re-baselined.
- `apps/docs-tests/visual/linear-gradient.spec.ts-snapshots/*.png` — re-baselined.
- `apps/docs-tests/visual/mesh-gradient.spec.ts-snapshots/*.png` — re-baselined.
- `apps/docs-tests/visual/noise-field.spec.ts-snapshots/*.png` — re-baselined.
- `apps/docs-tests/visual/vignette.spec.ts-snapshots/*.png` — re-baselined.
- `apps/docs-tests/visual/waves.spec.ts-snapshots/*.png` — re-baselined.
- `apps/docs-tests/visual/film-grain.spec.ts-snapshots/*.png` — likely unchanged (verify; refresh if needed).
- `docs/superpowers/specs/2026-05-30-example-palette-design.md` — update "Open questions" with implementation outcomes if any.

**Deleted:**
- `apps/docs/src/app/dev/palette/page.tsx` — superseded by the permanent `/palette` route.

---

## Phase 1 — Palette module + reference page

**Validation gate at end of phase:** open `http://localhost:3000/palette`, scroll through the brand foundation + accent palette + Aurora comparison + stress tests, toggle dark/light bg. Aurora and every other registry component still ship its OLD defaults — nothing user-visible should change yet outside the new `/palette` route. Confirm the `/dev/palette` route 404s (it was deleted) but no console errors elsewhere.

### Task 1.1: Generate accent hex values via culori

**Files:**
- Create: `apps/docs/src/lib/palette.gen.ts`
- Modify: `apps/docs/package.json` (add `culori` devDep)

- [ ] **Step 1: Install culori as a devDep of the docs app**

```bash
vp install -D culori --filter @matter/docs
vp install -D @types/culori --filter @matter/docs
```

Expected: `apps/docs/package.json` gains `culori` and `@types/culori` under `devDependencies`. `pnpm-lock.yaml` updated.

- [ ] **Step 2: Write the generator script**

Create `apps/docs/src/lib/palette.gen.ts`:

```ts
// One-shot generator. Run via `pnpm tsx apps/docs/src/lib/palette.gen.ts`.
// Output is hand-copied into apps/docs/src/lib/palette.ts. Committed for reproducibility.
import { formatHex, parse } from 'culori'

const OKLCH = {
  amber: {
    dark:  'oklch(0.338 0.100 75)',
    mid:   'oklch(0.788 0.177 75)',
    light: 'oklch(0.894 0.110 75)',
  },
  blue: {
    dark:  'oklch(0.328 0.107 252)',
    mid:   'oklch(0.682 0.176 252)',
    light: 'oklch(0.849 0.107 252)',
  },
  violet: {
    dark:  'oklch(0.330 0.105 295)',
    mid:   'oklch(0.690 0.174 295)',
    light: 'oklch(0.853 0.107 295)',
  },
  pink: {
    dark:  'oklch(0.333 0.103 343)',
    mid:   'oklch(0.694 0.174 343)',
    light: 'oklch(0.857 0.107 343)',
  },
} as const

for (const [hue, steps] of Object.entries(OKLCH)) {
  console.log(`\n${hue}:`)
  for (const [step, oklch] of Object.entries(steps)) {
    const parsed = parse(oklch)
    if (!parsed) throw new Error(`culori failed to parse ${oklch}`)
    const hex = formatHex(parsed)
    console.log(`  ${step.padEnd(6)} ${oklch.padEnd(28)} -> ${hex}`)
  }
}
```

- [ ] **Step 3: Run the generator and capture output**

```bash
pnpm --filter @matter/docs exec tsx apps/docs/src/lib/palette.gen.ts
```

Expected: 12 hex values printed to stdout, one per accent step. Copy the output verbatim — Task 1.2 inlines them into `palette.ts`. Note any out-of-gamut warnings from culori (none expected for these values, but watch for them).

- [ ] **Step 4: Commit**

```bash
git add apps/docs/package.json apps/docs/src/lib/palette.gen.ts pnpm-lock.yaml
git commit -m "chore(docs): add culori + palette hex generator script"
```

### Task 1.2: Create the palette module

**Files:**
- Create: `apps/docs/src/lib/palette.ts`

- [ ] **Step 1: Write `palette.ts` with all tokens**

Use the hex values output by Task 1.1 step 3 to fill in the four accent groups. The brand gray and brand lime hex values are explicit-source-of-truth from the spec (do not run them through the generator — the brand provides them as hex).

Create `apps/docs/src/lib/palette.ts`:

```ts
// Matter example color palette.
//
// Brand foundation (gray + lime full 12-step scales) defines the chrome.
// Accent palette (4 hues × dark/mid/light) gives example components 12 vibrant
// picks sampled from a shared OKLCH master at perceptually-equivalent steps.
//
// Hex values for the accent palette are sRGB conversions of OKLCH definitions;
// see `palette.gen.ts` for the conversion script. Brand gray and lime hex are
// the canonical brand source (not derived from OKLCH).
//
// Spec: docs/superpowers/specs/2026-05-30-example-palette-design.md

/** Brand black. Equal to gray[0]; aliased for clarity at usage sites. */
export const black = '#0B0F0D'

/** Brand white. Equal to gray[11]; aliased for clarity at usage sites. */
export const white = '#E7E9E7'

/** Brand gray scale. 12 steps, deep ink at index 0 → paper at index 11. */
export const gray = [
  '#0B0F0D', '#131614', '#202421', '#2B302D', '#363B38', '#424844',
  '#535A55', '#6D736E', '#8B918C', '#A1A6A1', '#D0D3CF', '#E7E9E7',
] as const

/** Brand lime scale (h=120). Index 9 (#A3C100) is the canonical brand lime. */
export const lime = [
  '#111505', '#171C04', '#242E00', '#2F3C00', '#3A4A00', '#465900',
  '#576E00', '#6E8A00', '#91AF00', '#A3C100', '#CCE288', '#E3F0BD',
] as const

/** Canonical brand lime alias. Equivalent to `lime[9]`. */
export const brandLime = lime[9]

/** Accent: amber (h=75, warm). */
export const amber = {
  /** oklch(0.338 0.100 75) */
  dark:  '<HEX-FROM-GEN>',
  /** oklch(0.788 0.177 75) — vibrant peak */
  mid:   '<HEX-FROM-GEN>',
  /** oklch(0.894 0.110 75) — soft tint */
  light: '<HEX-FROM-GEN>',
} as const

/** Accent: blue (h=252, cool primary). */
export const blue = {
  /** oklch(0.328 0.107 252) */
  dark:  '<HEX-FROM-GEN>',
  /** oklch(0.682 0.176 252) — vibrant peak */
  mid:   '<HEX-FROM-GEN>',
  /** oklch(0.849 0.107 252) — soft tint */
  light: '<HEX-FROM-GEN>',
} as const

/** Accent: violet (h=295, deep). */
export const violet = {
  /** oklch(0.330 0.105 295) */
  dark:  '<HEX-FROM-GEN>',
  /** oklch(0.690 0.174 295) — vibrant peak */
  mid:   '<HEX-FROM-GEN>',
  /** oklch(0.853 0.107 295) — soft tint */
  light: '<HEX-FROM-GEN>',
} as const

/** Accent: pink (h=343, accent / contrast). */
export const pink = {
  /** oklch(0.333 0.103 343) */
  dark:  '<HEX-FROM-GEN>',
  /** oklch(0.694 0.174 343) — vibrant peak */
  mid:   '<HEX-FROM-GEN>',
  /** oklch(0.857 0.107 343) — soft tint */
  light: '<HEX-FROM-GEN>',
} as const

/** Convenience grouping for iteration. */
export const palette = { black, white, gray, lime, brandLime, amber, blue, violet, pink } as const

/**
 * OKLCH source-of-truth strings for the reference page to render with full
 * fidelity (CSS `oklch()` is more precise than the sRGB hex conversion).
 * Order matches the `palette` export.
 */
export const paletteOklch = {
  // Brand sources are defined as hex; keep them as hex here (browsers render fine).
  black: '#0B0F0D',
  white: '#E7E9E7',
  gray, // hex array — brand source
  // Lime scale's canonical form: OKLCH at h=120.
  lime: [
    'oklch(0.185 0.031 120)', 'oklch(0.216 0.043 120)', 'oklch(0.280 0.080 120)',
    'oklch(0.331 0.111 120)', 'oklch(0.377 0.137 120)', 'oklch(0.428 0.161 120)',
    'oklch(0.496 0.184 120)', 'oklch(0.585 0.205 120)', 'oklch(0.703 0.205 120)',
    'oklch(0.761 0.186 120)', 'oklch(0.875 0.117 120)', 'oklch(0.933 0.068 120)',
  ] as const,
  amber: {
    dark:  'oklch(0.338 0.100 75)',
    mid:   'oklch(0.788 0.177 75)',
    light: 'oklch(0.894 0.110 75)',
  },
  blue: {
    dark:  'oklch(0.328 0.107 252)',
    mid:   'oklch(0.682 0.176 252)',
    light: 'oklch(0.849 0.107 252)',
  },
  violet: {
    dark:  'oklch(0.330 0.105 295)',
    mid:   'oklch(0.690 0.174 295)',
    light: 'oklch(0.853 0.107 295)',
  },
  pink: {
    dark:  'oklch(0.333 0.103 343)',
    mid:   'oklch(0.694 0.174 343)',
    light: 'oklch(0.857 0.107 343)',
  },
} as const
```

Replace every `<HEX-FROM-GEN>` placeholder with the matching value from Task 1.1 step 3 output. Do not leave placeholders in the file.

- [ ] **Step 2: Typecheck the module**

```bash
vp run typecheck --filter @matter/docs
```

Expected: clean. If errors, fix the file (likely a missing comma or typo).

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/lib/palette.ts
git commit -m "feat(docs): add palette module (brand foundation + accent palette)"
```

### Task 1.3: Build the `/palette` reference page

**Files:**
- Create: `apps/docs/src/app/palette/page.tsx`
- Create: `apps/docs/src/app/palette/PaletteView.tsx`

- [ ] **Step 1: Create the route entry**

Create `apps/docs/src/app/palette/page.tsx`:

```tsx
import { PaletteView } from './PaletteView'

export const metadata = {
  title: 'Palette — Matter',
  description: 'The brand-aligned color palette used by every Matter example.',
}

export default function PalettePage() {
  return <PaletteView />
}
```

No `dynamic({ ssr: false })` wrap is needed because the page renders pure DOM (no `three/webgpu` imports).

- [ ] **Step 2: Create the view component**

Use the most recent `/dev/palette` page as the starting point but rewrite it to import from `palette.ts` (single source of truth) and `paletteOklch` (for accurate visual rendering). Strip the dark/light toggle if you want — the docs site already has theme toggling at the chrome level — but keeping the local toggle is also fine since this page is its own visual exhibit. Keep both for now.

Create `apps/docs/src/app/palette/PaletteView.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { palette, paletteOklch } from '@/lib/palette'

const { black, white, gray, lime, amber, blue, violet, pink } = palette
const { lime: limeOklch, amber: amberOklch, blue: blueOklch, violet: violetOklch, pink: pinkOklch } = paletteOklch

const ACCENTS = [
  { name: 'amber',  angle: 75,  steps: amber,  oklch: amberOklch },
  { name: 'blue',   angle: 252, steps: blue,   oklch: blueOklch },
  { name: 'violet', angle: 295, steps: violet, oklch: violetOklch },
  { name: 'pink',   angle: 343, steps: pink,   oklch: pinkOklch },
] as const

// Aurora old → new (with-depth variant).
const AURORA = [
  { name: 'green',  oldHex: '#09E24B', newRef: 'lime[9]',     newColor: limeOklch[9] },
  { name: 'blue',   oldHex: '#1837E6', newRef: 'blue.dark',   newColor: blueOklch.dark },
  { name: 'violet', oldHex: '#661ACC', newRef: 'violet.dark', newColor: violetOklch.dark },
  { name: 'pink',   oldHex: '#CC1A99', newRef: 'pink.mid',    newColor: pinkOklch.mid },
] as const

export function PaletteView() {
  const [bg, setBg] = useState<'dark' | 'light'>('dark')
  // … (the body of /dev/palette page, refactored to read from the imports above)
}
```

Then port the rendering sections (`Section`, `ScaleRow`, `ColorBlock`, `GradientBlock`, `AccentTriad`, header, dark/light toggle, all the sections from the latest `/dev/palette/page.tsx`) into this `PaletteView` body. Render the **lime full scale** using `limeOklch` (CSS `oklch()`), render **gray** using the hex array (brand source), render **accents** using `paletteOklch` (so the visual is gamut-mapped by the browser, not the hex conversion). Keep the **Aurora old vs new variants** section. Drop the "uniform-mid" variant — the spec locked in the with-depth variant only — and rename "with-depth" to just "new defaults."

- [ ] **Step 3: Make the page accessible from the docs sidebar**

Modify `apps/docs/src/content/nav.config.ts`. In the `Overview` group items array, add a link after `/examples`:

```ts
items: [
  { kind: 'page', slug: '/getting-started' },
  { kind: 'page', slug: '/cli' },
  { kind: 'page', slug: '/changelog' },
  { kind: 'page', slug: '/examples' },
  { kind: 'link', label: 'Palette', url: '/palette' },
],
```

- [ ] **Step 4: Run the dev server and verify**

```bash
vp run dev:docs
```

Open `http://localhost:3000/palette` — expect the full reference page. Verify:
- All scales render
- Brand lime (lime[9]) is ringed in the lime row
- Aurora comparison shows old vs new (just two columns; uniform-mid is gone)
- Toggle dark/light works
- The "Palette" link appears in the Overview sidebar group

If anything is broken, fix in the `PaletteView` file (most likely an import or destructure mismatch).

- [ ] **Step 5: Commit**

```bash
git add apps/docs/src/app/palette apps/docs/src/content/nav.config.ts
git commit -m "feat(docs): add /palette reference page"
```

### Task 1.4: Delete the dev preview page

**Files:**
- Delete: `apps/docs/src/app/dev/palette/page.tsx`

- [ ] **Step 1: Remove the dev page**

```bash
rm -rf apps/docs/src/app/dev/palette
```

Visit `http://localhost:3000/dev/palette` — expect Next's 404 page. The permanent `/palette` covers the same content.

- [ ] **Step 2: Sanity check that nothing references the dev route**

```bash
grep -rn "/dev/palette" apps/docs/ docs/ 2>/dev/null
```

Expected: no matches (or only matches in commit-history references that are fine to leave).

- [ ] **Step 3: Commit**

```bash
git add -A apps/docs/src/app/dev/palette
git commit -m "chore(docs): remove /dev/palette (superseded by /palette)"
```

### Phase 1 stop-and-play gate

- [ ] **Step 1: Lint + typecheck**

```bash
vp run typecheck --filter @matter/docs
vp lint --filter @matter/docs
```

Expected: clean across the docs app.

- [ ] **Step 2: Hand the user the verification checklist**

In conversation:
1. Visit `/palette` — does the page read correctly? Does the "Palette" link appear in the sidebar?
2. Toggle dark/light bg — does it work?
3. Visit Aurora (`/components/aurora`), MeshGradient, LinearGradient, NoiseField, DotField, Waves, FilmGrain, Vignette — confirm **no visible change** to any of them (defaults haven't moved yet; this phase only adds the palette module + reference page).

Wait for the user to confirm before moving to Phase 2.

---

## Phase 2 — Aurora pivots to with-depth defaults

**Validation gate at end of phase:** visit `/components/aurora`. Aurora's stack is now `lime[9]` top, `blue.dark` + `violet.dark` deep bottoms, `pink.mid` mid. Sky is `blue.dark`; horizon is brand black. The result should feel "moodier and more sophisticated" than the old neon-rainbow Aurora — that's the intended shift. Visual baseline regenerates in Phase 5.

### Task 2.1: Update Aurora wrapper defaults

**Files:**
- Modify: `registry/aurora/aurora.tsx:45-65`

- [ ] **Step 1: Read the current defaults**

```bash
sed -n '40,70p' registry/aurora/aurora.tsx
```

Confirm the current `DEFAULT_LAYERS` and `horizonColor`/`skyColor` defaults match what's documented in the spec.

- [ ] **Step 2: Update `DEFAULT_LAYERS` and the function defaults**

Edit `registry/aurora/aurora.tsx`. Replace the four-layer literal:

```ts
export const DEFAULT_LAYERS: [AuroraLayer, AuroraLayer, AuroraLayer, AuroraLayer] = [
  { hex: '#09e24b', speed: 0.07, intensity: 0.6, variation: 0 },
  { hex: '#1837e6', speed: 0.1, intensity: 0, variation: 5 },
  { hex: '#661acc', speed: 0.15, intensity: 0.3, variation: 11 },
  { hex: '#cc1a99', speed: 0.07, intensity: 0, variation: 17 },
]
```

…with the new with-depth variant. Use the hex values from `apps/docs/src/lib/palette.ts` (look them up in the file; they were generated in Task 1.1). The registry component stays dependency-free — DO NOT add an `import` from `apps/docs/src/lib/palette`. Inline the hex values with comments pointing to the palette tokens:

```ts
export const DEFAULT_LAYERS: [AuroraLayer, AuroraLayer, AuroraLayer, AuroraLayer] = [
  { hex: '#A3C100', speed: 0.07, intensity: 0.6, variation: 0 },  // palette.lime[9] — brand lime
  { hex: '<BLUE.DARK-HEX>', speed: 0.1, intensity: 0, variation: 5 },     // palette.blue.dark
  { hex: '<VIOLET.DARK-HEX>', speed: 0.15, intensity: 0.3, variation: 11 }, // palette.violet.dark
  { hex: '<PINK.MID-HEX>', speed: 0.07, intensity: 0, variation: 17 },   // palette.pink.mid
]
```

Then update the destructured defaults in the function signature (lines ~62-64):

```ts
horizonColor = '#0B0F0D',  // palette.black — was '#040009'
skyColor = '<BLUE.DARK-HEX>',  // palette.blue.dark — was '#146389'
layers = DEFAULT_LAYERS,
```

Replace every `<…-HEX>` placeholder with the actual hex from `apps/docs/src/lib/palette.ts`.

- [ ] **Step 3: Typecheck the registry**

```bash
vp run typecheck --filter @matter/registry
```

Expected: clean. The change is hex literals only — no type or structure shifts.

- [ ] **Step 4: Commit**

```bash
git add registry/aurora/aurora.tsx
git commit -m "feat(registry): aurora default colors pivot to with-depth palette picks"
```

### Task 2.2: Update Aurora docs page initial Tweakpane state

**Files:**
- Modify: `apps/docs/src/app/components/aurora/page.tsx:55-61`

- [ ] **Step 1: Read current initial state**

```bash
sed -n '50,70p' apps/docs/src/app/components/aurora/page.tsx
```

- [ ] **Step 2: Update the initial Tweakpane state hex constants**

Edit `apps/docs/src/app/components/aurora/page.tsx`. Replace the initial-state literal so it matches the new wrapper defaults exactly (otherwise the playground starts in a state that disagrees with the registry default, which is confusing for users reading the docs):

```ts
horizonColor: '#0B0F0D',
skyColor: '<BLUE.DARK-HEX>',
layers: [
  { hex: '#A3C100', speed: 0.07, intensity: 0.6, variation: 0 },
  { hex: '<BLUE.DARK-HEX>', speed: 0.1, intensity: 0, variation: 5 },
  { hex: '<VIOLET.DARK-HEX>', speed: 0.15, intensity: 0.3, variation: 11 },
  { hex: '<PINK.MID-HEX>', speed: 0.07, intensity: 0, variation: 17 },
],
```

This page CAN import from `@/lib/palette` (it's an app-internal page, not a registry component). Optionally:

```ts
import { palette } from '@/lib/palette'

// initial Tweakpane state ↓
horizonColor: palette.black,
skyColor: palette.blue.dark,
layers: [
  { hex: palette.lime[9], speed: 0.07, intensity: 0.6, variation: 0 },
  { hex: palette.blue.dark, speed: 0.1, intensity: 0, variation: 5 },
  { hex: palette.violet.dark, speed: 0.15, intensity: 0.3, variation: 11 },
  { hex: palette.pink.mid, speed: 0.07, intensity: 0, variation: 17 },
],
```

Pick whichever form reads cleaner with the surrounding code. Either works — but DO NOT mix forms (don't have some hex inline and others via `palette.*` in the same literal).

- [ ] **Step 3: Run the dev server and eyeball Aurora**

```bash
vp run dev:docs
```

Open `http://localhost:3000/components/aurora`. Confirm:
- Aurora renders without errors
- The default state matches what `/palette` shows as "Aurora — new defaults"
- The Tweakpane "Reset" or initial state matches the wrapper defaults
- Moving any Tweakpane color picker still works (the page's controls aren't broken)

- [ ] **Step 4: Commit**

```bash
git add apps/docs/src/app/components/aurora/page.tsx
git commit -m "feat(docs): align aurora playground initial state with new defaults"
```

### Phase 2 stop-and-play gate

- [ ] **Step 1: Hand the user the verification checklist**

In conversation:
1. Visit `/components/aurora` — does the new look feel right? It WILL be visibly different (chartreuse top, deep-purple bottoms instead of the old spring-green + cobalt/violet/magenta). The point is brand alignment, not preservation.
2. Visit `/palette` — does the "Aurora — old vs new" gradient match what `/components/aurora` actually renders? They should be identical.
3. Any visual regressions in OTHER components on the page (sidebar, chrome)? Should be no — chrome doesn't change in this phase.

Wait for user confirmation. If user wants tuning (e.g., "violet/dark is too dark, try violet[5]"), iterate before Phase 3 — the spec allows revising specific picks.

Visual baseline for Aurora regenerates in Phase 5 (one batched pass).

---

## Phase 3 — Gradient family (linear-gradient + mesh-gradient)

**Validation gate at end of phase:** `/components/linear-gradient` and `/components/mesh-gradient` show new defaults. Linear gradient: lime[9] → blue.mid (a "brand-cool" sweep). MeshGradient palette A: amber.mid + blue.mid + pink.mid + lime[8] (a vibrant rainbow); palette B: violet.dark + gray[1] + pink.mid + amber.dark (a moody mix that preserves the original palette B's deep-warm feel).

### Task 3.1: Update LinearGradient wrapper defaults

**Files:**
- Modify: `registry/linear-gradient.tsx:26`

- [ ] **Step 1: Update `DEFAULT_COLORS`**

Edit `registry/linear-gradient.tsx`. Replace:

```ts
const DEFAULT_COLORS = ['#ff7b72', '#7b9cff']
```

with:

```ts
const DEFAULT_COLORS = ['#A3C100', '<BLUE.MID-HEX>']  // palette.lime[9] → palette.blue.mid
```

Replace `<BLUE.MID-HEX>` with the actual hex from `apps/docs/src/lib/palette.ts`.

- [ ] **Step 2: Commit**

```bash
git add registry/linear-gradient.tsx
git commit -m "feat(registry): linear-gradient default pair pivots to brand lime + blue.mid"
```

### Task 3.2: Update LinearGradient docs page initial state

**Files:**
- Modify: `apps/docs/src/app/components/linear-gradient/page.tsx:14`

- [ ] **Step 1: Update the initial colors literal**

Edit `apps/docs/src/app/components/linear-gradient/page.tsx`. Change:

```ts
{ name: 'colors', type: 'colors', default: ['#ff7b72', '#7b9cff'] },
```

to (with `palette` imported from `@/lib/palette` at the top of the file if not already):

```ts
{ name: 'colors', type: 'colors', default: [palette.lime[9], palette.blue.mid] },
```

- [ ] **Step 2: Run the dev server and eyeball**

```bash
vp run dev:docs
```

Open `/components/linear-gradient`. Confirm the default gradient is now lime → blue. The Tweakpane color pickers should still work.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/app/components/linear-gradient/page.tsx
git commit -m "feat(docs): align linear-gradient playground with new defaults"
```

### Task 3.3: Update MeshGradient wrapper defaults

**Files:**
- Modify: `registry/mesh-gradient/mesh-gradient.tsx:24-37`

- [ ] **Step 1: Update both palettes**

Edit `registry/mesh-gradient/mesh-gradient.tsx`. Replace `DEFAULT_PALETTE_A` and `DEFAULT_PALETTE_B`:

```ts
const DEFAULT_PALETTE_A: [string, string, string, string] = [
  '<AMBER.MID-HEX>',  // palette.amber.mid
  '<BLUE.MID-HEX>',   // palette.blue.mid
  '<PINK.MID-HEX>',   // palette.pink.mid
  '#91AF00',          // palette.lime[8] — slightly deeper than brand lime for variety
]

const DEFAULT_PALETTE_B: [string, string, string, string] = [
  '<VIOLET.DARK-HEX>', // palette.violet.dark
  '#131614',           // palette.gray[1] — was '#202a32' (swampy black)
  '<PINK.MID-HEX>',    // palette.pink.mid
  '<AMBER.DARK-HEX>',  // palette.amber.dark — preserves the "darkAmber" mood
]
```

Replace every `<…-HEX>` placeholder. The rationale: palette A is "vibrant rainbow at mid step" preserving the original's lively feel; palette B keeps the moody warm/deep mix of the original.

- [ ] **Step 2: Typecheck**

```bash
vp run typecheck --filter @matter/registry
```

- [ ] **Step 3: Commit**

```bash
git add registry/mesh-gradient/mesh-gradient.tsx
git commit -m "feat(registry): mesh-gradient default palettes pivot to brand-aligned picks"
```

### Task 3.4: Update MeshGradient docs page initial state

**Files:**
- Modify: `apps/docs/src/app/components/mesh-gradient/page.tsx:46-54`

- [ ] **Step 1: Update the initial Tweakpane state**

Edit `apps/docs/src/app/components/mesh-gradient/page.tsx`. Replace the eight hex constants (`a0`..`a3`, `b0`..`b3`) so they match the new wrapper defaults exactly. If `palette` is imported, use `palette.amber.mid` etc.; otherwise inline the hex values with `// palette.*` comments. Match form to the surrounding code style.

- [ ] **Step 2: Run the dev server and eyeball**

Open `/components/mesh-gradient`. Confirm:
- Palette A: vibrant amber/blue/pink/lime mesh — rainbow-leaning
- Palette B: moody violet/black/pink/amber mesh — preserves the "deep warm" feel
- The toggle between palettes works
- Tweakpane "Reset" returns to the new defaults

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/app/components/mesh-gradient/page.tsx
git commit -m "feat(docs): align mesh-gradient playground with new defaults"
```

### Phase 3 stop-and-play gate

- [ ] **Step 1: Verification checklist**

In conversation:
1. Visit `/components/linear-gradient` — does the new lime → blue default feel right?
2. Visit `/components/mesh-gradient` — does palette A feel vibrant? Does palette B preserve the moody-warm look you expect?
3. Both still respond to Tweakpane edits without breaking?

Wait for user confirmation before Phase 4.

---

## Phase 4 — Noise family + monochrome (dot-field, noise-field, waves, vignette, film-grain)

**Validation gate at end of phase:** all five remaining components ship new defaults. Noise-field is a `gray[6]` → `gray[10]` ramp. Dot-field uses `gray[8]` dots on transparent (background is whatever's behind). Waves shifts from teal-mint to `lime[9]` on a `gray[1]` base. Vignette is brand black. FilmGrain is already grayscale — no change expected; we verify alignment.

### Task 4.1: Update NoiseField wrapper defaults

**Files:**
- Modify: `registry/noise-field.tsx:28`

- [ ] **Step 1: Update `DEFAULT_COLORS`**

Edit `registry/noise-field.tsx`. Replace:

```ts
const DEFAULT_COLORS = ['#0a0a0a', '#f5f5f5']
```

with:

```ts
const DEFAULT_COLORS = ['#424844', '#D0D3CF']  // palette.gray[5] → palette.gray[10] — muted ramp
```

The original was nearly black → nearly white. New version is mid-gray → light-gray, which makes the noise pattern less harsh and more in the brand's near-monochrome register. (If the user wants more contrast we can bump to `gray[2]` → `gray[11]` later.)

- [ ] **Step 2: Commit**

```bash
git add registry/noise-field.tsx
git commit -m "feat(registry): noise-field default ramp pivots to brand gray"
```

### Task 4.2: Update NoiseField docs page initial state

**Files:**
- Modify: `apps/docs/src/app/components/noise-field/page.tsx:30-31`, line 125

- [ ] **Step 1: Read current state**

```bash
sed -n '25,40p' apps/docs/src/app/components/noise-field/page.tsx
sed -n '120,130p' apps/docs/src/app/components/noise-field/page.tsx
```

- [ ] **Step 2: Update both occurrences**

Edit the file. Update the Tweakpane initial state (lines ~30-31):

```ts
color0: palette.gray[5],
color1: palette.gray[10],
```

And the inline example snippet (line ~125):

```ts
colors={[palette.gray[5], palette.gray[10]]}
```

Add `import { palette } from '@/lib/palette'` if not present.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/app/components/noise-field/page.tsx
git commit -m "feat(docs): align noise-field playground with new defaults"
```

### Task 4.3: Update DotField wrapper defaults

**Files:**
- Modify: `registry/dot-field.tsx:29`

- [ ] **Step 1: Update `DEFAULTS.color`**

Edit `registry/dot-field.tsx`. Replace:

```ts
const DEFAULTS = { spacing: 30, dotSize: 2, color: '#888888', reach: 100, strength: 1 } as const
```

with:

```ts
const DEFAULTS = { spacing: 30, dotSize: 2, color: '#8B918C', reach: 100, strength: 1 } as const  // palette.gray[8]
```

The shift is from `#888888` (cool gray) to `#8B918C` (brand gray with a barely-perceptible greenish tint matching the rest of the system).

- [ ] **Step 2: Commit**

```bash
git add registry/dot-field.tsx
git commit -m "feat(registry): dot-field default color pivots to brand gray[8]"
```

### Task 4.4: Update DotField docs page initial state (if present)

**Files:**
- Possibly modify: `apps/docs/src/app/components/dot-field/page.tsx`

- [ ] **Step 1: Check for hardcoded hex**

```bash
grep -n "#[0-9a-fA-F]" apps/docs/src/app/components/dot-field/page.tsx
```

- [ ] **Step 2: Update any color literals that match the old default**

If you find `'#888888'` in the dot-field page, replace with `palette.gray[8]` (importing `palette` if not already imported). Skip any color literal that doesn't refer to the dot color itself (e.g., MDX prose backgrounds).

- [ ] **Step 3: Commit**

```bash
git add apps/docs/src/app/components/dot-field/page.tsx
git commit -m "feat(docs): align dot-field playground with new defaults"
```

If nothing changed in step 2, skip the commit and move on.

### Task 4.5: Update Waves wrapper defaults

**Files:**
- Modify: `registry/waves.tsx:32`

- [ ] **Step 1: Update `DEFAULTS.color`**

Edit `registry/waves.tsx`. Replace:

```ts
color: '#77eecc',
```

with:

```ts
color: '#A3C100',  // palette.lime[9] — brand lime
```

(The spec also notes waves could use `blue.dark → lime[9]` as a two-color ramp, but waves currently takes only one color. Stick with single-color brand lime for now; a multi-color waves variant is out of scope.)

- [ ] **Step 2: Commit**

```bash
git add registry/waves.tsx
git commit -m "feat(registry): waves default color pivots to brand lime"
```

### Task 4.6: Update Waves docs page initial state

**Files:**
- Modify: `apps/docs/src/app/components/waves/page.tsx:27`

- [ ] **Step 1: Update the Tweakpane initial color**

Edit `apps/docs/src/app/components/waves/page.tsx`. Replace `'#77eecc'` with `palette.lime[9]` (or inline the hex `'#A3C100'` if the file uses the inline-with-comment form). Add the palette import if not already present.

- [ ] **Step 2: Commit**

```bash
git add apps/docs/src/app/components/waves/page.tsx
git commit -m "feat(docs): align waves playground with new defaults"
```

### Task 4.7: Update Vignette wrapper defaults

**Files:**
- Modify: `registry/vignette/vignette.tsx:24` (and the JSDoc on line 15)

- [ ] **Step 1: Confirm current default**

```bash
sed -n '10,30p' registry/vignette/vignette.tsx
```

- [ ] **Step 2: Update the default color**

Edit `registry/vignette/vignette.tsx`. Change:

```ts
/** What color to fade edges toward. Default '#000000'. */
…
color = '#000000',
```

to:

```ts
/** What color to fade edges toward. Default brand black (palette.black). */
…
color = '#0B0F0D',  // palette.black
```

The shift from pure `#000000` to brand black (`#0B0F0D`) is subtle — barely visible. The point is "the entire system anchors at the brand black, not at arbitrary pure black." If you ever look at the gradient between vignette + scene against brand-black chrome, they should match exactly.

- [ ] **Step 3: Commit**

```bash
git add registry/vignette/vignette.tsx
git commit -m "feat(registry): vignette default color pivots to brand black"
```

### Task 4.8: Verify FilmGrain alignment

**Files:**
- Possibly modify: `registry/film-grain/film-grain.tsx`, `apps/docs/src/app/components/film-grain/page.tsx`

- [ ] **Step 1: Inspect FilmGrain wrapper for hex defaults**

```bash
grep -nE "#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}\b" registry/film-grain/film-grain.tsx apps/docs/src/app/components/film-grain/page.tsx
```

- [ ] **Step 2: Match to palette**

FilmGrain is a monochrome overlay — it likely has no color defaults at all (it computes grain values directly). If the grep finds nothing in the wrapper, the component is already aligned by virtue of being colorless. If it does find a hex, swap it to the closest `palette.gray[N]` value or `palette.black`/`palette.white` as appropriate, following the same wrapper-inline pattern used in earlier tasks.

The docs page may have demo chrome (background panels) using `#1a1a2a` etc. Leave those alone — those are page chrome, not example content, and are governed by globals.css (separate effort outside this spec).

- [ ] **Step 3: Commit (if needed)**

```bash
git add registry/film-grain apps/docs/src/app/components/film-grain
git commit -m "chore(registry): verify film-grain palette alignment"
```

If no changes were needed in step 2, skip the commit.

### Phase 4 stop-and-play gate

- [ ] **Step 1: Verification checklist**

In conversation:
1. Visit `/components/noise-field` — default ramp is muted gray-to-light-gray; the noise effect should feel softer than before
2. Visit `/components/dot-field` — dots are barely-tinted brand gray instead of pure gray
3. Visit `/components/waves` — base color is brand lime (chartreuse) instead of mint-teal
4. Visit `/components/vignette` — fade is to brand black (subtle difference from pure black)
5. Visit `/components/film-grain` — should look identical (no color changes)

Wait for user confirmation before Phase 5.

---

## Phase 5 — Visual baselines + changesets + cleanup

**Validation gate at end of phase:** `vp test:visual` passes against the regenerated baselines, lint + typecheck clean, changeset present, branch ready for PR.

### Task 5.1: Regenerate Playwright visual baselines

**Files:**
- Modify: `apps/docs-tests/visual/*-snapshots/*.png` (many PNGs across all affected components)

- [ ] **Step 1: Make sure the dev server is reachable in test mode**

The visual tests run against the actual dev server at port 3000 (or whatever Playwright's config specifies). Stop any user-facing dev server before running update:

```bash
# If port 3000 is in use:
lsof -ti:3000 | xargs kill 2>/dev/null || true
```

- [ ] **Step 2: Regenerate snapshots**

```bash
vp test:visual:update
```

This runs Playwright with `--update-snapshots`, regenerating PNGs for every visual test. Expected: ~7-10 specs run; new PNGs land in `apps/docs-tests/visual/*-snapshots/` for `aurora`, `dot-field`, `linear-gradient`, `mesh-gradient`, `noise-field`, `vignette`, `waves` (and possibly `film-grain` — verify it's a no-op delta).

If any test fails outright (not just "snapshot updated"), investigate — most likely cause is a console error in the new defaults. Fix the underlying issue, not the test.

- [ ] **Step 3: Inspect the regenerated baselines**

```bash
git status apps/docs-tests/visual/
git diff --stat apps/docs-tests/visual/
```

Open a few of the regenerated PNGs (e.g., `aurora-default.png`, `mesh-gradient-default.png`) and confirm they look like the new defaults — not the old ones, not corrupted.

- [ ] **Step 4: Verify the new baselines pass**

```bash
vp test:visual
```

Expected: all green. If anything fails, the baseline didn't update cleanly — re-run step 2 for that spec.

- [ ] **Step 5: Commit**

```bash
git add apps/docs-tests/visual/
git commit -m "test(visual): re-baseline snapshots for new palette defaults"
```

### Task 5.2: Final lint, typecheck, test sweep

- [ ] **Step 1: Lint everything**

```bash
vp lint
```

Expected: clean.

- [ ] **Step 2: Typecheck everything**

```bash
vp run typecheck
```

Expected: clean.

- [ ] **Step 3: Unit tests**

```bash
vp test
```

Expected: clean (no unit tests should be affected by color changes — but run them in case).

- [ ] **Step 4: Build everything**

```bash
vp run build
```

Expected: clean. Build verifies tsup, Next, and the Turbo cache are all consistent.

If any step fails, fix the underlying issue and commit before continuing.

### Task 5.3: Write the changeset

**Files:**
- Create: `.changeset/<random>.md`

- [ ] **Step 1: Generate**

```bash
pnpm changeset
```

Select:
- `@matter/registry` — **minor** bump (default colors changed across 7 components; ships to anyone who refreshes copies via the CLI)
- `@matter/docs` — no bump needed (docs site is internal, not published)

- [ ] **Step 2: Author the body**

Open the generated `.changeset/*.md` and write the body:

```md
---
'@matter/registry': minor
---

Default colors across every registry component pivot to a single brand-aligned
palette. Aurora, MeshGradient, LinearGradient, NoiseField, DotField, Waves, and
Vignette all now pull from the new palette (brand foundation: lime + gray; accent
palette: amber/blue/violet/pink at dark/mid/light). Users who pulled components
before this release keep their existing copies unchanged; only fresh CLI pulls
get the new defaults. See `/palette` on the docs site for the full reference.
```

- [ ] **Step 3: Commit**

```bash
git add .changeset
git commit -m "chore: changeset for MAT-13 palette pivot"
```

### Task 5.4: Update spec "Open questions" if any

**Files:**
- Possibly modify: `docs/superpowers/specs/2026-05-30-example-palette-design.md`

- [ ] **Step 1: Update spec if execution revealed surprises**

If anything during execution diverged from the spec (e.g., a registry component had a hex literal you didn't expect, or a specific OKLCH value was out of gamut and needed adjustment), append a "Notes from implementation" section at the bottom of the spec documenting what changed and why. Skip this task if execution went per spec.

- [ ] **Step 2: Commit (if updated)**

```bash
git add docs/superpowers/specs/2026-05-30-example-palette-design.md
git commit -m "docs(spec): notes from MAT-13 implementation"
```

### Task 5.5: Final branch hygiene

- [ ] **Step 1: Confirm git status is clean**

```bash
git status
```

Expected: clean working tree, branch ahead of main by N commits.

- [ ] **Step 2: Review the commit log**

```bash
git log main..HEAD --oneline
```

Confirm the commits read as a sensible story (palette module → reference page → component rewrites by family → baselines → changeset).

- [ ] **Step 3: Hand off**

In conversation: "Phase 5 complete — branch is ready for PR. Visual baselines regenerated, changeset written, lint/typecheck/test/build all clean. Want me to open the PR via `gh pr create`?"

Wait for user. Do NOT push or open a PR autonomously.

---

## Self-review checklist (for plan author)

Run after writing the plan, before handing off:

- [x] Every registry component listed in the spec (aurora, mesh-gradient, linear-gradient, dot-field, noise-field, waves, vignette, film-grain) has an explicit task touching it.
- [x] Every docs-site demo page that hardcodes hex (aurora, linear-gradient, mesh-gradient, noise-field, waves) has a task updating it. DotField and FilmGrain page tasks are gated on the grep finding a relevant literal (the survey at plan time showed none, but the task accounts for either outcome).
- [x] The TS module shape in Task 1.2 matches the spec section "Where the tokens live."
- [x] Visual baseline regeneration covers all affected components in one batched task (5.1) — avoids re-baselining seven times.
- [x] No placeholder text in tasks — every hex value either has a known source (palette.ts, generated in Task 1.1) or is explicitly a literal copied from existing code.
- [x] Type consistency: `palette.lime[9]` is used consistently across tasks (not `palette.lime.brand` or any other alias).
- [x] Shader files (`registry/*/shader.tsx`) are not edited by any task.
- [x] Each phase ends at an explicit stop-and-play gate, per user preference.
- [x] Aurora's `horizonColor` and `skyColor` (not in the spec's per-component table) are covered explicitly in Task 2.1 with brand-aligned picks (black + blue.dark).
