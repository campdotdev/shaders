// Tier 2 primitive metadata — one entry per documented primitive. Descriptions
// are intentionally one sentence (light-M4 scope: docs site as a "test space",
// not a teaching surface). The cross-link list under `usedBy` is verified by
// hand against actual `import { ... } from '@lovo/matter'` calls in
// registry/*.tsx — don't add a slug here unless that registry component
// genuinely calls the primitive.

export interface PrimitiveControl {
  name: string
  min: number
  max: number
  step: number
  default: number
}

export interface PrimitiveEntry {
  slug: string
  name: string
  description: string
  signature: string
  usedBy: readonly string[]
  controls: readonly PrimitiveControl[]
}

export const PRIMITIVES: readonly PrimitiveEntry[] = [
  {
    slug: 'color-ramp',
    name: 'colorRamp',
    description: 'Sample a color from a list of color stops at a position.',
    signature: `function colorRamp(
  t: TSLNode,
  stops: ColorRampStop[],
): TSLNode

interface ColorRampStop {
  color: TSLNode  // typically vec3(r, g, b)
  position: number  // 0..1
}`,
    usedBy: ['linear-gradient', 'noise-field', 'aurora'],
    controls: [
      { name: 'position', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  {
    slug: 'noise',
    name: 'noise',
    description: 'Single-octave perlin noise.',
    signature: `function noise(p: TSLNode): TSLNode
// p is a vec2 TSL node; returns a scalar roughly in [-1, 1].`,
    usedBy: ['noise-field', 'mesh-gradient', 'aurora'],
    controls: [
      { name: 'scale', min: 0.5, max: 10, step: 0.1, default: 3 },
      { name: 'speed', min: 0, max: 2, step: 0.01, default: 0.3 },
    ],
  },
  {
    slug: 'fbm',
    name: 'fbm',
    description: 'Fractal Brownian Motion — sums of noise at multiple scales.',
    signature: `function fbm(
  p: TSLNode,
  opts?: FBMOptions,
): TSLNode

interface FBMOptions {
  octaves?: number     // default 4
  lacunarity?: number  // default 2
  gain?: number        // default 0.5
}`,
    usedBy: ['noise-field', 'aurora'],
    controls: [
      { name: 'scale', min: 0.5, max: 10, step: 0.1, default: 3 },
      { name: 'octaves', min: 1, max: 8, step: 1, default: 4 },
      { name: 'lacunarity', min: 1, max: 4, step: 0.1, default: 2 },
      { name: 'gain', min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { name: 'speed', min: 0, max: 2, step: 0.01, default: 0.3 },
    ],
  },
  {
    slug: 'voronoi',
    name: 'voronoi',
    description: 'Cellular distance field (Worley noise).',
    signature: `function voronoi(p: TSLNode): TSLNode
// p is a vec2 TSL node; returns a scalar roughly in [0, 1].`,
    usedBy: ['noise-field'],
    controls: [
      { name: 'scale', min: 0.5, max: 10, step: 0.1, default: 4 },
      { name: 'speed', min: 0, max: 2, step: 0.01, default: 0.2 },
    ],
  },
  {
    slug: 'quantize',
    name: 'quantize',
    description: 'Step a scalar into a fixed number of discrete bins.',
    signature: `function quantize(t: TSLNode, steps: number): TSLNode
// steps is JS-side (baked into TSL at build time).`,
    usedBy: ['noise-field'],
    controls: [
      { name: 'bins', min: 2, max: 16, step: 1, default: 4 },
    ],
  },
  {
    slug: 'sdf-circle',
    name: 'sdfCircle',
    description: 'Signed distance field for a disk centered at the origin.',
    signature: `function sdfCircle(
  p: TSLNode,
  radius: TSLNode | number,
): TSLNode
// Negative inside, zero on edge, positive outside.`,
    usedBy: ['dot-field'],
    controls: [
      { name: 'radius', min: 0.05, max: 0.5, step: 0.01, default: 0.25 },
      { name: 'cx', min: 0, max: 1, step: 0.01, default: 0.5 },
      { name: 'cy', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  {
    slug: 'displace',
    name: 'displace',
    description: 'Vector add — shifts a sample point by a 2D offset.',
    signature: `function displace(p: TSLNode, by: TSLNode): TSLNode
// Returns p + by. SDF translation requires the NEGATED offset.`,
    usedBy: ['aurora', 'dot-field'],
    controls: [
      { name: 'x', min: -0.5, max: 0.5, step: 0.01, default: 0.1 },
      { name: 'y', min: -0.5, max: 0.5, step: 0.01, default: 0.05 },
    ],
  },
  {
    slug: 'cursor-ripple',
    name: 'cursorRipple',
    description: 'Cursor-spawned ripple displacement.',
    signature: `function cursorRipple(
  p: TSLNode,
  center: TSLNode,
  opts?: CursorRippleOptions,
): TSLNode

interface CursorRippleOptions {
  reach?: number      // default 0.4
  frequency?: number  // default 30
  speed?: number      // default 6
  amplitude?: number  // default 0.5
}`,
    usedBy: ['waves'],
    controls: [
      { name: 'amplitude', min: 0, max: 0.2, step: 0.005, default: 0.05 },
      { name: 'falloff', min: 1, max: 10, step: 0.5, default: 4 },
      { name: 'speed', min: 0.1, max: 3, step: 0.05, default: 1 },
    ],
  },
  {
    slug: 'time',
    name: 'time',
    description: 'Seconds since the scene mounted, as a TSL scalar node.',
    signature: `const time: TSLNode
// Re-exported from three/tsl. Builds chain-safe expressions when used as
// a chain root: time.mul(speed), sin(time.mul(2)), etc.`,
    usedBy: ['linear-gradient', 'noise-field', 'waves', 'mesh-gradient', 'aurora'],
    controls: [],
  },
  {
    slug: 'uv',
    name: 'uv',
    description: '2D fragment coordinate, 0..1 across the canvas.',
    signature: `function uv(): TSLNode
// Re-exported from three/tsl. Returns a vec2 in UV-space (0,0)→(1,1).`,
    usedBy: ['linear-gradient', 'noise-field', 'dot-field', 'waves', 'mesh-gradient', 'aurora'],
    controls: [],
  },
]
