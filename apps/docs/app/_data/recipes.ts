// Tier 3 recipe metadata — short TSL snippets that combine primitives. Each
// entry has a `source` string (what the user copy-pastes) AND a corresponding
// `build` callback in `apps/docs/app/recipes/_builds.ts` that produces the
// equivalent live preview. The two are hand-kept in sync — when you edit one,
// edit the other. The slugs in `primitivesUsed` MUST match entries in
// `_data/primitives.ts` so the cross-links resolve.

export interface RecipeEntry {
  slug: string
  name: string
  description: string
  primitivesUsed: readonly string[]
  source: string
}

export const RECIPES: readonly RecipeEntry[] = [
  {
    slug: 'animated-stripes',
    name: 'Animated stripes',
    description:
      'Vertical bands that scroll horizontally. Simplest combination of sin, time, and colorRamp.',
    primitivesUsed: ['time', 'uv', 'color-ramp'],
    source: `import { uv, time, vec3, vec4, sin, colorRamp } from '@lovo/matter'

const stripe = sin(uv().x.mul(20).add(time.mul(0.5)))
const t = stripe.mul(0.5).add(0.5).clamp(0, 1)
const stops = [
  { color: vec3(1, 0.5, 0.4), position: 0 },
  { color: vec3(0.4, 0.6, 1), position: 1 },
]
material.colorNode = vec4(colorRamp(t, stops), 1)`,
  },
  {
    slug: 'cursor-glow',
    name: 'Cursor glow',
    description:
      'A soft circular glow that follows the cursor. Demonstrates length, smoothstep, and a cursor uniform.',
    primitivesUsed: ['uv'],
    source: `import { uv, vec4, length, smoothstep, uniform } from '@lovo/matter'
import { Vector2 } from 'three/webgpu'

// cursorUniform is a uniform(Vector2) updated by useCursor() in your component.
const cursorUniform = uniform(new Vector2(0.5, 0.5))

const dist = length(uv().sub(cursorUniform))
const glow = smoothstep(0.3, 0, dist)
material.colorNode = vec4(glow, glow.mul(0.7), glow.mul(1.5), 1)`,
  },
  {
    slug: 'plasma',
    name: 'Plasma',
    description:
      'FBM-driven color swirl. The canonical "shader-y" look from one primitive.',
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
  },
  {
    slug: 'cellular-tiles',
    name: 'Cellular tiles',
    description:
      'Voronoi cells quantized into discrete tiles. Useful for organic-but-discrete textures.',
    primitivesUsed: ['voronoi', 'quantize', 'uv'],
    source: `import { uv, vec4, voronoi, quantize } from '@lovo/matter'

const cells = voronoi(uv().mul(8))
const tiered = quantize(cells, 4)
material.colorNode = vec4(tiered, tiered.mul(0.7), tiered.mul(0.5), 1)`,
  },
]
