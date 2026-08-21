export interface RecipeVariant {
  key: string;
  label: string;
  note: string;
}

export interface RecipeEntry {
  slug: string;
  name: string;
  description: string;
  primitivesUsed: readonly string[];
  source: string;
  variants: readonly RecipeVariant[];
}

export const RECIPES: readonly RecipeEntry[] = [
  {
    slug: 'animated-stripes',
    name: 'Animated stripes',
    description:
      'Warm/cool vertical bands that scroll horizontally. Simplest combination of sin, time, and colorRamp.',
    primitivesUsed: ['time', 'color-ramp'],
    source: `import { uv, vec3, vec4, sin } from 'three/tsl'
import { elapsedTime, colorRamp } from '@camp-dev/shaders'

const stripe = sin(uv().x.mul(20).add(elapsedTime.mul(2)))
const normalizedStripe = stripe.mul(0.5).add(0.5).clamp(0, 1)
const stops = [
  { color: vec3(1, 0.5, 0.4), position: 0 },
  { color: vec3(0.4, 0.6, 1), position: 1 },
]
material.colorNode = vec4(colorRamp(normalizedStripe, stops), 1)`,
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
        note: 'Replace `elapsedTime.mul(2)` with `sin(elapsedTime).mul(2)` for a pulsing rather than scrolling feel.',
      },
    ],
  },
  {
    slug: 'cursor-glow',
    name: 'Cursor glow',
    description:
      'A magenta-blue glow that follows the cursor. Demonstrates length, smoothstep, and a cursor uniform.',
    primitivesUsed: [],
    source: `import { uv, vec4, length, smoothstep, uniform } from 'three/tsl'
import { Vector2 } from 'three/webgpu'

// cursorUniform is a uniform(Vector2) updated by useCursor() in your component.
const cursorUniform = uniform(new Vector2(0.5, 0.5))

const distance = length(uv().sub(cursorUniform))
const glow = smoothstep(0.3, 0, distance)
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
    primitivesUsed: ['fbm', 'time', 'color-ramp'],
    source: `import { uv, vec2, vec3, vec4 } from 'three/tsl'
import { elapsedTime, fractalNoise, colorRamp } from '@camp-dev/shaders'

const scrolledTime = elapsedTime.mul(0.3)
const samplePosition = uv().mul(2).add(vec2(scrolledTime, scrolledTime))
const noiseValue = fractalNoise(samplePosition, { octaves: 4 }).mul(0.5).add(0.5).clamp(0, 1)
const stops = [
  { color: vec3(0.4, 0.0, 0.8), position: 0 },
  { color: vec3(1, 0.4, 0.6), position: 0.5 },
  { color: vec3(0.4, 0.9, 1), position: 1 },
]
material.colorNode = vec4(colorRamp(noiseValue, stops), 1)`,
    variants: [
      {
        key: 'canonical',
        label: 'Canonical',
        note: 'The base — 3-stop purple/pink/cyan ramp over fractal noise with octaves: 4.',
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
    primitivesUsed: ['voronoi', 'quantize', 'color-ramp'],
    source: `import { uv, vec4 } from 'three/tsl'
import { voronoi, quantize } from '@camp-dev/shaders'

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
];
