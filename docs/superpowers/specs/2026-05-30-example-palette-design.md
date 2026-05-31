# Matter example color palette — design

**Date:** 2026-05-30 (original) · revised 2026-05-31 to reflect final implementation.
**Status:** Implemented on branch `hunter/mat-13-set-a-side-wide-color-palette`.

## Intent

Establish a single named color palette that every Matter example — registry component defaults, docs-site demos, MDX snippets — pulls from. The goal is consistency: when a visitor moves between the Aurora demo, the mesh-gradient demo, and the linear-gradient demo, the examples should feel like they belong to the same family rather than like seven artists made seven palettes.

The palette is **brand-anchored**: it builds on an existing OKLCH-based color system that drives site chrome and branding. Brand lime (`#A3C100`, `oklch(0.761 0.186 120)`, step 10 of the 12-step brand scale) is the lead. Brand gray and brand black/white are the neutrals. The accent palette adds 12 vibrant hues sampled around the wheel, hand-tuned in OKLCH so the `base` step lands at (or near) Aurora's original chroma where applicable.

## The palette as shipped

The TypeScript module at [`apps/docs/src/lib/palette.ts`](../../apps/docs/src/lib/palette.ts) exports:

### Brand foundation

| Export | Shape | Description |
| --- | --- | --- |
| `black` | string | `#0B0F0D` — brand black anchor (= `gray[0]`) |
| `white` | string | `#E7E9E7` — brand white anchor (= `gray[11]`) |
| `gray` | 12-step array | Full brand gray scale, deep ink → paper, hex-canonical |
| `limeScale` | 12-step array | Full brand lime scale at h=120, hex-canonical |
| `brandLime` | string | `#A3C100` — `limeScale[9]`, canonical brand lime |

### Accent palette — 12 hues × {light, base, dark}

Each accent is exported as a named const object. All values are OKLCH-derived (see [`palette.gen.ts`](../../apps/docs/src/lib/palette.gen.ts) for the conversion script).

| Name | Hue (°) | light L/C | base L/C | dark L/C | Notes |
| --- | --- | --- | --- | --- | --- |
| `red` | 25 | 0.748 / 0.200 | 0.628 / 0.258 | 0.478 / 0.210 | |
| `orange` | 55 | 0.788 / 0.155 | 0.668 / 0.205 | 0.518 / 0.165 | |
| `amber` | 85 | 0.892 / 0.120 | 0.792 / 0.168 | 0.642 / 0.140 | |
| `lime` | 120 | 0.922 / 0.140 | 0.842 / 0.185 | 0.692 / 0.160 | Brand hue — `lime.base` is `#bcdc33` |
| `green` | 145.897 | 0.892 / 0.180 | 0.795 / 0.242 | 0.645 / 0.200 | **Aurora-anchored.** `base` = `#0ae24b` (within 1 byte of Aurora's `#09e24b`) |
| `teal` | 175 | 0.865 / 0.115 | 0.745 / 0.165 | 0.595 / 0.140 | |
| `cyan` | 205 | 0.748 / 0.095 | 0.628 / 0.135 | 0.478 / 0.115 | |
| `sky` | 235 | 0.665 / 0.135 | 0.545 / 0.175 | 0.395 / 0.145 | |
| `blue` | 265.847 | 0.585 / 0.200 | 0.465 / 0.258 | 0.345 / 0.200 | **Aurora-anchored.** `base` = `#1837e6` (Aurora's cobalt exact) |
| `violet` | 293.328 | 0.580 / 0.185 | 0.460 / 0.238 | 0.340 / 0.190 | **Aurora-anchored.** `base` = `#661acc` (Aurora's violet exact) |
| `purple` | 320 | 0.630 / 0.190 | 0.510 / 0.245 | 0.360 / 0.200 | |
| `magenta` | 343.895 | 0.693 / 0.185 | 0.573 / 0.232 | 0.423 / 0.190 | **Aurora-anchored.** `base` = `#cc1a99` (Aurora's magenta exact) |

The four **Aurora-anchored** hues have their hue angles tuned so the OKLCH base step (at the chroma values shown) lands at or within 1 byte of Aurora's original hexes. This means Aurora's iconic neon colors literally are `palette.green.base` / `blue.base` / `violet.base` / `magenta.base` — Aurora is the canonical example of "what `base` looks like at full vibrancy" for these hues.

### Naming conventions

- **Step names** are `light` / `base` / `dark`. `base` is always the most vibrant peak.
- **Aggregate export** `palette` groups everything for iteration (see [`palette.ts:160-166`](../../apps/docs/src/lib/palette.ts)).
- **OKLCH source** is exported as `paletteOklch` for the reference page to render with browser-native `oklch()` strings (more accurate than the sRGB hex conversion).

## Where the tokens live

A single TypeScript module: [`apps/docs/src/lib/palette.ts`](../../apps/docs/src/lib/palette.ts).

Docs-site demos `import { palette } from '@/lib/palette'` and reference colors by name (e.g. `palette.green.base`, `palette.amber.dark`, `palette.brandLime`).

**Registry components remain dependency-free** — they're shadcn-style copy-paste artifacts shipped to user projects via the CLI. They inline hex literals with `// palette.*` comments noting provenance:

```ts
// registry/aurora/aurora.tsx
export const DEFAULT_LAYERS: [AuroraLayer, AuroraLayer, AuroraLayer, AuroraLayer] = [
  { hex: '#0ae24b', speed: 0.07, intensity: 0.6, variation: 0 },  // palette.green.base
  { hex: '#1837e6', speed: 0.1, intensity: 0, variation: 5 },     // palette.blue.base
  { hex: '#661acc', speed: 0.15, intensity: 0.3, variation: 11 }, // palette.violet.base
  { hex: '#cc1a99', speed: 0.07, intensity: 0, variation: 17 },   // palette.magenta.base
]
```

## Reference page

Live at [`/palette`](../../apps/docs/src/app/palette/PaletteView.tsx). Renders:
- Brand foundation (full `gray` + `limeScale` 12-step scales, brand black/white anchors)
- Accent palette (12 triads in hue-angle order)
- Aurora old vs new defaults (now visually identical — kept as documentation of the palette-anchoring)
- Sample compositions (cool ramp, warm ramp, soft pastel, full-wheel `base` rainbow)
- Stress test (all 12 `base` accents + brand lime on brand ink and brand paper)

Linked from the docs sidebar under the Overview group.

## Component defaults as shipped

All seven existing registry components pivoted to palette-anchored defaults. Visual baselines in `apps/docs-tests/visual/` regenerated where needed.

| Component | Defaults | Picks |
| --- | --- | --- |
| `aurora` | 4 layers + horizon + sky | `green.base`, `blue.base`, `violet.base`, `magenta.base` (visually identical to original); `horizonColor` and `skyColor` preserved from original |
| `linear-gradient` | 2 stops | `lime.light` → `green.dark` — analogous chartreuse-to-emerald sweep, L 0.92 → 0.65 for depth |
| `mesh-gradient` palette A | 4 corners (cool spring) | `lime.base`, `green.base`, `teal.base`, `sky.base` — 115° analogous span |
| `mesh-gradient` palette B | 4 corners (warm sunset) | `amber.base`, `orange.base`, `red.base`, `magenta.base` — ~100° warm analogous span |
| `dot-field` | 1 dot color | `gray[8]` (#8B918C) — brand-tinted mid-gray |
| `noise-field` | 2-color ramp | `gray[1]` → `gray[11]` (deep ink → brand white) |
| `waves` | 1 color | `teal.base` (#00cda6) — water-like accent, distinct from Aurora's lime-led palette |
| `vignette` | fade color | brand black (`#0B0F0D`) |
| `film-grain` | (none) | Monochrome by design; no color defaults |

The gradient-family picks (linear-gradient and mesh-gradient) explicitly follow analogous-hue + lightness-depth rules saved as a behavioral preference in [`feedback_gradient_design.md`](../../../../.claude/projects/-Users-hunter-garrett-Documents--personal-matter/memory/feedback_gradient_design.md).

## Non-goals (still firm)

- **No CSS custom properties added by this spec.** Palette is a TS constant. The docs site's existing `--bg`/`--fg`/etc. for theme stay as-is.
- **No runtime palette switching.** Users can't theme Matter components via this palette — it's a curated set baked into defaults.
- **No published `@matter/palette` package.** The palette is a docs-site internal. Registry components remain copy-paste-clean.
- **No font / radius / spacing tokens.** Just colors.
- **No chrome migration.** The docs site's globals.css `--bg`/`--fg` may eventually pivot to the brand foundation, but that's a separate effort outside this spec.

## Future work (deferred to separate efforts)

Captured in [`project_color_features.md`](../../../../.claude/projects/-Users-hunter-garrett-Documents--personal-matter/memory/project_color_features.md):

- **`colorSpace` prop on gradient/ramp components** (`<LinearGradient>`, `<MeshGradient>`, `<NoiseField>`) — controls the interpolation working space. Once shipped, the through-gray rule in the gradient guidelines partially relaxes for OKLCH-mixed gradients.
- **`gamut` prop on `<MatterScene>`** — controls the output color space (sRGB vs display-p3). Orthogonal to `colorSpace`. P3 support enables wider-saturation rendering on capable displays.

## Evolution (for historical context)

The design went through ~7 substantive iterations during brainstorming + implementation:

1. **Initial proposal** (4 hues): Aurora's 4 colors + 4 new complementary hues at `dark/mid/light` tiers.
2. **Brand pivot**: User shared brand lime + brand gray 12-step scales; palette restructured around those.
3. **Full OKLCH system**: Expanded to 14 hue scales × 12 steps each (perceptually-uniform Radix-style).
4. **Slim down**: Per user, kept brand foundation full 12-step but reduced accents to 4 hues × 3 steps.
5. **Expand accents**: Per user, expanded back to ~13 accent hues at 3 steps each.
6. **Drop crimson**: Hue at 17° too close to red at 25°.
7. **Re-tune for vibrancy**: Aurora's original `#09e24b` etc. felt more vivid than the OKLCH-derived values. Final design tuned OKLCH base step to match Aurora's chroma; renamed `pink → magenta`; renamed `yellowGreen → lime` at brand hue 120; the 12-step brand lime scale was renamed to `limeScale` to free up `lime` for the accent triad.

Each iteration's commits are on the branch. The "Future work" section above captures planned features that didn't ship as part of MAT-13.
