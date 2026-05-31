# Matter example color palette — design

**Date:** 2026-05-30
**Status:** Approved (brainstorming complete; awaiting spec review before planning)

## Intent

Establish a single named color palette that every Matter example — registry component defaults, docs-site demos, MDX snippets — pulls from. The goal is consistency: when a visitor moves between the Aurora demo, the mesh-gradient demo, and the linear-gradient demo, the examples should feel like they belong to the same family rather than like seven artists made seven palettes.

The palette is **brand-anchored**: it builds on an existing OKLCH-based color system that already drives site chrome and branding. Brand lime (`oklch(0.761 0.186 120)`, the `lime/10` step) is the lead. Brand gray and brand black/white are the neutrals. Examples pull a small curated set of accent hues at a small number of named steps.

## The palette

Three groups: brand foundation (full 12-step scales), accent palette (4 hues × 3 named steps), brand anchors (black + white).

### Brand foundation — full 12-step scales

Used broadly across the site (chrome, type, panels, accents). Examples may use any step.

**Gray scale** (brand, near-zero chroma — explicit hex, used as-is):

| Step | Hex |
| --- | --- |
| 1 | `#0B0F0D` |
| 2 | `#131614` |
| 3 | `#202421` |
| 4 | `#2B302D` |
| 5 | `#363B38` |
| 6 | `#424844` |
| 7 | `#535A55` |
| 8 | `#6D736E` |
| 9 | `#8B918C` |
| 10 | `#A1A6A1` |
| 11 | `#D0D3CF` |
| 12 | `#E7E9E7` |

**Lime scale** (brand, h=120, OKLCH-defined):

| Step | OKLCH | Hex (approx) |
| --- | --- | --- |
| 1 | `oklch(0.185 0.031 120)` | `#111505` |
| 2 | `oklch(0.216 0.043 120)` | `#171C04` |
| 3 | `oklch(0.280 0.080 120)` | `#242E00` |
| 4 | `oklch(0.331 0.111 120)` | `#2F3C00` |
| 5 | `oklch(0.377 0.137 120)` | `#3A4A00` |
| 6 | `oklch(0.428 0.161 120)` | `#465900` |
| 7 | `oklch(0.496 0.184 120)` | `#576E00` |
| 8 | `oklch(0.585 0.205 120)` | `#6E8A00` |
| 9 | `oklch(0.703 0.205 120)` | `#91AF00` |
| **10** | `oklch(0.761 0.186 120)` | `#A3C100` ← **brand lime** |
| 11 | `oklch(0.875 0.117 120)` | `#CCE288` |
| 12 | `oklch(0.933 0.068 120)` | `#E3F0BD` |

### Accent palette — 4 hues × 3 steps

Sampled from the same OKLCH master used to generate the brand lime scale. Three steps per hue:

- **dark** = step 4 (L ≈ 0.33) — deep, hue-tinted
- **mid** = step 10 (L ≈ 0.69) — most vibrant, brand-lime equivalence
- **light** = step 11 (L ≈ 0.85) — light tint

| Hue | Angle | dark | mid | light |
| --- | --- | --- | --- | --- |
| `amber` | 75 | `oklch(0.338 0.100 75)` | `oklch(0.788 0.177 75)` | `oklch(0.894 0.110 75)` |
| `blue` | 252 | `oklch(0.328 0.107 252)` | `oklch(0.682 0.176 252)` | `oklch(0.849 0.107 252)` |
| `violet` | 295 | `oklch(0.330 0.105 295)` | `oklch(0.690 0.174 295)` | `oklch(0.853 0.107 295)` |
| `pink` | 343 | `oklch(0.333 0.103 343)` | `oklch(0.694 0.174 343)` | `oklch(0.857 0.107 343)` |

One warm (amber), two cool (blue, violet), one accent (pink). Each step is perceptually equivalent across hues — picking `blue/mid` and `pink/mid` together gives matched visual weight.

### Brand anchors

| Name | Hex |
| --- | --- |
| `black` | `#0B0F0D` (= `gray/1`) |
| `white` | `#E7E9E7` (= `gray/12`) |

Aliases for clarity at usage sites; they live in the gray scale.

## Where the tokens live

A single TypeScript module — `apps/docs/src/lib/palette.ts` — exports the named constants:

```ts
export const palette = {
  black: '#0B0F0D',
  white: '#E7E9E7',
  gray: ['#0B0F0D', '#131614', /* ... 12 steps ... */] as const,
  lime: [
    'oklch(0.185 0.031 120)',
    /* ... 12 steps ... */
    'oklch(0.761 0.186 120)', // step 10 — brand lime
    /* ... */
  ] as const,
  amber: {
    dark:  'oklch(0.338 0.100 75)',
    mid:   'oklch(0.788 0.177 75)',
    light: 'oklch(0.894 0.110 75)',
  },
  blue:   { dark: '...', mid: '...', light: '...' },
  violet: { dark: '...', mid: '...', light: '...' },
  pink:   { dark: '...', mid: '...', light: '...' },
} as const

// Convenience alias matching most-common pick:
export const brandLime = palette.lime[9] // step 10
```

Docs-site demos `import { palette }` and reference colors by name. **The registry components do not import this module** — they're copy-paste artifacts shipped to user projects via the CLI and must remain dependency-free. Instead, when a registry component's default colors are updated, the OKLCH values are copied verbatim from this module with a comment noting the palette name (e.g., `// palette.blue.dark`).

## Application guidance

| Component | Recommended picks | Notes |
| --- | --- | --- |
| `aurora` | `lime/10`, `blue/dark`, `violet/dark`, `pink/mid` | "with-depth" variant — preserves bright-top / deep-bottoms feel. Replaces current `#09e24b / #1837e6 / #661acc / #cc1a99` |
| `mesh-gradient` | mix of `amber/mid`, `pink/mid`, `blue/mid`, `lime/9` or `10` | Warm + cool mix; multiple ramps available — at least one ramp keeps a warm look |
| `linear-gradient` | default pair: `lime/10` + `blue/mid` (or similar two-mid pair) | Replaces current `#ff7b72 → #7b9cff` |
| `dot-field` | `gray/9` dots on `gray/2` bg (default); add `lime/mid` or accent `/mid` for highlight variants | Effect is already busy; vibrant peaks reserved for accent variants |
| `noise-field` | `gray/7` to `gray/11` ramp (default); accent variants use any `dark → mid` ramp | Same reasoning |
| `waves` | `blue/dark → lime/10` ramp (default); also viable: `violet/dark → pink/mid` | Same reasoning |
| `film-grain` | `gray` only | Effect is intentionally monochrome |
| `vignette` | `black` + `gray/2` only | Same reasoning |

This is **guidance, not law** — example authors can deviate when an effect benefits from a different pick, but the named palette is the only source of color values.

## Roll-out scope

What this spec covers:

1. **The palette module** — `apps/docs/src/lib/palette.ts` with brand foundation, accent palette, and brand anchors as named exports. OKLCH strings are the canonical form; hex is computed once where needed (for the gray scale, hex is canonical since the brand gray is defined as explicit hex).
2. **A palette reference page** — replaces the `/dev/palette` demo with a permanent reference at `/palette` (or under a docs subroute — final location decided during planning), surfaced from docs navigation. Shows brand foundation scales, accent triads, and usage guidance.
3. **Registry component defaults rewrite** — update default colors in:
   - `registry/aurora/aurora.tsx` (the four color stops shift to with-depth variant)
   - `registry/mesh-gradient/mesh-gradient.tsx` (ramps rewritten using palette picks)
   - `registry/linear-gradient.tsx` (default pair pivots to palette)
   - `registry/dot-field.tsx`, `registry/noise-field.tsx`, `registry/waves.tsx` (default colors pivot to gray + accent picks)
   - `registry/vignette/vignette.tsx` (default colors pivot to brand black + gray)
   - `registry/film-grain` already grayscale — verify alignment with brand gray
4. **Docs-site demo updates** — any demo pages or MDX snippets that hardcode hex values switch to `palette.*` imports
5. **Visual regression baselines refresh** — Playwright baselines re-captured for all affected components

## Non-goals

- **No CSS custom properties added by this spec.** Palette is a TS constant. The docs site has existing `--bg`/`--fg`/etc. for theme — those keep working; CSS-var theming is out of scope.
- **No runtime palette switching.** Users can't theme Matter components via this palette — it's a curated set baked into defaults, not a knob.
- **No additional accent steps (yet).** A `deep` step at step 7 (L≈0.49) might be useful — Aurora's with-depth blue/dark is moodier than the original — but adding it is deferred to a v2 if real usage demands more lightness range. YAGNI for v1.
- **No more accent hues.** 4 hues + lime + gray covers v1. Adding red/teal/sky/indigo/etc. waits for demonstrated need.
- **No published `@matter/palette` package.** The palette is a docs-site internal. Registry components remain copy-paste-clean.
- **No font / radius / spacing tokens.** Just colors.
- **No chrome migration.** The docs site's globals.css `--bg`/`--fg` may eventually pivot to the brand foundation, but that's a separate effort outside this spec.

## Open questions

None outstanding at spec time. OKLCH values are revisable; the named structure (`lime[1..12]`, `amber.{dark,mid,light}`, etc.) is the load-bearing API.

## Roll-out phasing (sketch — actual plan written separately)

Honoring the project's "many small phases with stop-and-play gates" pacing preference, ~5 phases:

1. **Palette module + reference page** — define the tokens, ship a public reference page. Validation: open the reference page, scroll, feel.
2. **Apply to Aurora** — Aurora's four stops shift to with-depth variant. Validation: open Aurora demo, compare to old screenshot.
3. **Apply to gradient-family components** — `linear-gradient` + `mesh-gradient` defaults rewritten. Validation: open both demos.
4. **Apply to noise-family + monochrome components** — `dot-field`, `noise-field`, `waves`, `film-grain`, `vignette` defaults rewritten. Validation: open all five demos.
5. **Visual regression refresh** — re-record Playwright baselines for all changed components. Validation: `pnpm test:visual` passes on the new baselines.

Each phase is 1–2 days. The reference page from phase 1 doubles as the validation surface for phases 2–4 (visitor checks the swatches and the demos side-by-side).
