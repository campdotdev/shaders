// Tier 3 recipe metadata — short TSL snippets that combine primitives. Each
// entry has a `source` string (what the user copy-pastes) AND a corresponding
// set of `build` callbacks in `apps/docs/app/recipes/_builds.ts` that produce
// the equivalent live previews. The `source` matches the FIRST variant
// (canonical); subsequent variants are described by a one-line `note`
// telling the reader what to change in the source to reach that look.
//
// Build callbacks are looked up by composite key '<recipe-slug>.<variant-key>'.
// The slugs in `primitivesUsed` MUST match entries in `src/data/primitives.ts`
// so the cross-links resolve.

export interface RecipeVariant {
  /** Stable identifier composed with the recipe slug to look up RECIPE_BUILDS. */
  key: string
  /** Displayed under the preview card. */
  label: string
  /** One-line "to get this, change X to Y" prose under the label. */
  note: string
}

export interface RecipeEntry {
  slug: string
  name: string
  description: string
  primitivesUsed: readonly string[]
  /** Canonical source the user copy-pastes. Matches variants[0]. */
  source: string
  /** First entry is canonical (its build matches `source`). 2-3 entries. */
  variants: readonly RecipeVariant[]
}

export const RECIPES: readonly RecipeEntry[] = [
  {
    slug: 'animated-stripes',
    name: 'Animated stripes',
    description:
      'Warm/cool vertical bands that scroll horizontally. Simplest combination of sin, time, and colorRamp.',
    primitivesUsed: ['time', 'uv', 'color-ramp'],
    source: `import { uv, time, vec3, vec4, sin, colorRamp } from '@lovo/matter'

const stripe = sin(uv().x.mul(20).add(time.mul(2)))
const t = stripe.mul(0.5).add(0.5).clamp(0, 1)
const stops = [
  { color: vec3(1, 0.5, 0.4), position: 0 },
  { color: vec3(0.4, 0.6, 1), position: 1 },
]
material.colorNode = vec4(colorRamp(t, stops), 1)`,
    variants: [
      {
        key: 'canonical',
        label: 'Canonical',
        note: 'The base — sin-based stripes scrolling left-to-right.',
      },
      {
        key: 'diagonal',
        label: 'Diagonal',
        note: 'Add `uv().y.mul(8)` to the phase for diagonal motion.',
      },
      {
        key: 'pulse',
        label: 'Pulse',
        note: 'Replace `time.mul(2)` with `sin(time).mul(2)` for a pulsing rather than scrolling feel.',
      },
    ],
  },
  {
    slug: 'cursor-glow',
    name: 'Cursor glow',
    description:
      'A magenta-blue glow that follows the cursor. Demonstrates length, smoothstep, and a cursor uniform.',
    primitivesUsed: ['uv'],
    source: `import { uv, vec4, length, smoothstep, uniform } from '@lovo/matter'
import { Vector2 } from 'three/webgpu'

// cursorUniform is a uniform(Vector2) updated by useCursor() in your component.
const cursorUniform = uniform(new Vector2(0.5, 0.5))

const dist = length(uv().sub(cursorUniform))
const glow = smoothstep(0.3, 0, dist)
material.colorNode = vec4(glow, glow.mul(0.7), glow.mul(1.5), 1)`,
    variants: [
      {
        key: 'circular',
        label: 'Circular (canonical)',
        note: 'The base — circular falloff via length(...) with smoothstep at 0.3 reach.',
      },
      {
        key: 'square',
        label: 'Square',
        note: 'Replace `length(uv().sub(cursorUniform))` with `max(uv().x.sub(cursorUniform.x).abs(), uv().y.sub(cursorUniform.y).abs())` for a Chebyshev (square) falloff.',
      },
      {
        key: 'pinpoint',
        label: 'Pinpoint',
        note: 'Tighten the smoothstep edge from 0.3 to 0.1 and use `vec4(glow, glow, glow, 1)` for a small white pinpoint.',
      },
    ],
  },
  {
    slug: 'plasma',
    name: 'Plasma',
    description: 'FBM-driven color swirl. The canonical "shader-y" look from one primitive.',
    primitivesUsed: ['fbm', 'time', 'uv', 'color-ramp'],
    source: `import { uv, time, vec2, vec3, vec4, fbm, colorRamp } from '@lovo/matter'

const t = time.mul(0.3)
const p = uv().mul(2).add(vec2(t, t))
const f = fbm(p, { octaves: 4 }).mul(0.5).add(0.5).clamp(0, 1)
const stops = [
  { color: vec3(0.4, 0.0, 0.8), position: 0 },
  { color: vec3(1, 0.4, 0.6), position: 0.5 },
  { color: vec3(0.4, 0.9, 1), position: 1 },
]
material.colorNode = vec4(colorRamp(f, stops), 1)`,
    variants: [
      {
        key: 'canonical',
        label: 'Canonical',
        note: 'The base — 3-stop purple/pink/cyan ramp over fbm with octaves: 4.',
      },
      {
        key: 'monochrome-marble',
        label: 'Monochrome marble',
        note: 'Swap the colorful 3-stop ramp for a 2-stop dark/light gradient — plasma becomes marble.',
      },
    ],
  },
  {
    slug: 'cellular-tiles',
    name: 'Cellular tiles',
    description:
      'Voronoi cells flattened into 4 discrete sepia bands — a mosaic / stained-glass / low-poly aesthetic. Use as a hand-crafted-feeling background where each region renders one solid color rather than a gradient.',
    primitivesUsed: ['voronoi', 'quantize', 'uv', 'color-ramp'],
    source: `import { uv, vec4, voronoi, quantize } from '@lovo/matter'

const cells = voronoi(uv().mul(8))
const tiered = quantize(cells, 4)
material.colorNode = vec4(tiered, tiered.mul(0.7), tiered.mul(0.5), 1)`,
    variants: [
      {
        key: 'canonical',
        label: 'Canonical',
        note: 'The base — 4 quantized cells per region in a warm sepia palette.',
      },
      {
        key: 'coarse-mosaic',
        label: 'Coarse mosaic',
        note: 'Larger cells (`uv().mul(4)`) and fewer bins (`quantize(cells, 3)`) — chunky mosaic for big background shapes.',
      },
      {
        key: 'fine-stained-glass',
        label: 'Fine stained glass',
        note: 'Many tight cells (`uv().mul(14)`) with 8 bins fed through a jewel-toned `colorRamp` — denser, jewel-like.',
      },
    ],
  },
]
