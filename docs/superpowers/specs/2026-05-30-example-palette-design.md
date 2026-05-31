# Matter example color palette — design

**Date:** 2026-05-30
**Status:** Approved (brainstorming complete; awaiting spec review before planning)

## Intent

Establish a single named color palette that every Matter example — registry component defaults, docs-site demos, MDX snippets — pulls from. The goal is consistency: when a visitor moves between the Aurora demo, the mesh-gradient demo, and the linear-gradient demo, the examples should feel like they belong to the same family rather than like seven artists made seven palettes.

The palette is **vibrant by default** (Matter's brand is colorful, not muted), with a parallel muted tier so examples whose effect is already loud can dial saturation down without breaking the family resemblance.

## The palette

Three tiers. Vibrant and muted share names — each muted hex is the same hue at lower saturation/value.

### Vibrant tier (8 hues, ~45° apart around the wheel)

| Name | Hex | Origin |
| --- | --- | --- |
| `lime` | `#09e24b` | Aurora — kept exact |
| `cyan` | `#06b6d4` | New, fills green→blue gap |
| `cobalt` | `#1837e6` | Aurora — kept exact |
| `violet` | `#661acc` | Aurora — kept exact |
| `magenta` | `#cc1a99` | Aurora — kept exact |
| `coral` | `#f43f5e` | New, fills magenta→amber |
| `amber` | `#f59e0b` | New |
| `yellow` | `#fbbf24` | New, fills amber→lime loop-close |

Aurora's existing four hues are preserved bit-for-bit so the Aurora demo doesn't shift when the palette lands.

### Muted tier (same 8 names, lower saturation)

| Name | Hex |
| --- | --- |
| `lime` | `#4a8f5a` |
| `cyan` | `#456f80` |
| `cobalt` | `#5466b8` |
| `violet` | `#724a9b` |
| `magenta` | `#9c4889` |
| `coral` | `#b56872` |
| `amber` | `#bb8a3a` |
| `yellow` | `#c7a73f` |

Saturation lands around 35–45% (vs. 75–95% for vibrant). Same hue family, so a vibrant `lime` and a muted `lime` read as siblings.

### Neutral tier

| Name | Hex | Role |
| --- | --- | --- |
| `ink` | `#0a0a14` | Dark page background (matches docs `--bg`) |
| `deep` | `#1a1a26` | Panel / card background on dark |
| `mid` | `#4a4a5a` | Borders, dividers, hint text |
| `paper` | `#f5f5f7` | Light page background |
| `cream` | `#fafaf7` | Warm-toned alternative to paper |

## Where the tokens live

A single TypeScript module — `apps/docs/src/lib/palette.ts` — exports the named constants and tier groupings:

```ts
export const palette = {
  vibrant: {
    lime:    '#09e24b',
    cyan:    '#06b6d4',
    cobalt:  '#1837e6',
    violet:  '#661acc',
    magenta: '#cc1a99',
    coral:   '#f43f5e',
    amber:   '#f59e0b',
    yellow:  '#fbbf24',
  },
  muted: {
    lime:    '#4a8f5a',
    // …
  },
  neutral: {
    ink:    '#0a0a14',
    // …
  },
} as const
```

Docs-site demos `import { palette }` and reference colors by name. **The registry components do not import this module** — they're copy-paste artifacts shipped to user projects via the CLI and must remain dependency-free. Instead, when a registry component's default colors are updated, the hex values are copied verbatim from this module (with a comment noting the palette name for searchability, e.g., `// palette.vibrant.lime`).

## Application guidance

Each Matter example picks colors from the tier that fits the effect's intensity:

| Component | Recommended tier | Notes |
| --- | --- | --- |
| `aurora` | vibrant (4 stops) | No change — already correct |
| `mesh-gradient` | vibrant (2–4 stops) | Default ramp pivots to palette hues; warm-look variant uses `coral`/`amber`/`yellow` |
| `linear-gradient` | vibrant (2 stops) | Default pair pivots from `#ff7b72 → #7b9cff` to a palette pair |
| `dot-field` | muted | Effect is already busy; vibrant would compete |
| `noise-field` | muted | Same reasoning |
| `waves` | muted | Same reasoning |
| `film-grain` | neutral only | Effect is intentionally monochrome |
| `vignette` | neutral only | Same reasoning |

This is **guidance, not law** — example authors can deviate when the effect benefits from a different tier, but the named palette is the only source of hex values.

## Roll-out scope

What this spec covers:

1. **The palette module** — `apps/docs/src/lib/palette.ts` with all three tiers, named exports, and `as const` typing
2. **A palette reference page** — replaces the `/dev/palette` demo with a permanent reference at `/palette` (or under `/examples/palette`), surfaced from docs navigation
3. **Registry component defaults rewrite** — update default colors in:
   - `registry/mesh-gradient/mesh-gradient.tsx` (warm look retained but with palette hex)
   - `registry/linear-gradient.tsx` (default pair pivots to palette)
   - `registry/dot-field.tsx`, `registry/noise-field.tsx`, `registry/waves.tsx` (default colors pivot to muted tier)
   - `registry/aurora/aurora.tsx` and `registry/vignette/vignette.tsx` left unchanged (already aligned)
4. **Docs-site demo updates** — any demo pages that hardcode hex values in `apps/docs/src/app/` switch to `palette.*` imports
5. **Visual regression baselines refresh** — Playwright baselines re-captured for affected components (`mesh-gradient`, `linear-gradient`, `dot-field`, `noise-field`, `waves`)

## Non-goals

- **No CSS custom properties.** Palette is a TS constant only. Docs site already has `--bg`/`--fg`/etc. for theme — those stay; the palette is for example content, not chrome.
- **No runtime palette switching.** Users can't theme Matter components via this palette — it's a curated set baked into defaults, not a knob.
- **No new tiers (yet).** A "soft" tier (vibrant tint over paper) or a "deep" tier (saturated but dark) might be useful later, but they're not in v1 — YAGNI until an example needs one.
- **No published `@matter/palette` package.** The palette is a docs-site internal. Registry components remain copy-paste-clean with literal hex values.
- **No font / radius / spacing tokens.** Just colors.

## Open questions

None outstanding at spec time. If the user wants to swap any hex values during plan or execution, they can — the spec is the named structure; the hex values are easily revisable as long as the structure holds.

## Roll-out phasing (sketch — actual plan written separately)

To honor the project's "many small phases with stop-and-play gates" pacing preference, this work splits into ~4 phases, each ending at a runnable state:

1. **Palette module + reference page** — define the tokens, ship the public reference page. Validation: open `/palette`, scroll, feel.
2. **Apply to gradient-family components** — `linear-gradient` + `mesh-gradient` defaults rewritten. Validation: open the two demos, feel the new defaults.
3. **Apply to noise-family components** — `dot-field` + `noise-field` + `waves` defaults rewritten to muted tier. Validation: open all three demos.
4. **Visual regression refresh** — re-record Playwright baselines for changed components. Validation: `pnpm test:visual` passes.

Each phase is 1–3 days. Aurora, vignette, film-grain are untouched. The reference page from phase 1 doubles as the validation surface for phases 2–3 (visitor checks the swatches and the demos side-by-side).
