'use client'

import {
  colorRamp,
  type ColorRampStop,
  cursorRipple,
  displace,
  fbm,
  noise,
  quantize,
  sdfCircle,
  time,
  voronoi,
} from '@lovo/matter'
import { ShaderScene, useShaderContext } from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import type { ShaderNodeObject } from 'three/tsl'
import { mix, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'

import type { PropsState } from './PropsPlayground'

// Discriminated union of every primitive's parameter shape. Adding a primitive
// is a four-touch change that TypeScript enforces:
//   1. Add a variant here
//   2. Add a builder function
//   3. Add a case to the dispatch in PrimitiveMesh
//   4. Add a case to buildPrimitiveParams (the runtime boundary validator)
// The `_exhaustive: never` line in the dispatch's default branch causes TS to
// fail compilation if you skip step 3, and the switch in buildPrimitiveParams
// catches a missed step 4 at the dev/build seam.
export type PrimitiveParams =
  | { slug: 'color-ramp'; position: number }
  | { slug: 'noise'; scale: number; speed: number }
  | {
      slug: 'fbm'
      scale: number
      speed: number
      octaves: number
      lacunarity: number
      gain: number
    }
  | { slug: 'voronoi'; scale: number; speed: number }
  | { slug: 'quantize'; bins: number }
  | { slug: 'sdf-circle'; radius: number; cx: number; cy: number }
  | { slug: 'displace'; x: number; y: number }
  | { slug: 'cursor-ripple'; amplitude: number; falloff: number; speed: number }
  | { slug: 'time' }

// Per-variant alias so builder signatures stay short.
type ParamsFor<S extends PrimitiveParams['slug']> = Extract<PrimitiveParams, { slug: S }>

interface PrimitiveSceneProps {
  primitive: PrimitiveParams
}

// Runtime boundary: convert PropsPlayground's loose state (Record<string, PropValue>)
// into the strict PrimitiveParams union. Throws if a primitive's controls in
// @/data/primitives.ts have drifted from this validator (a programmer error,
// caught at the dev seam instead of silently rendering NaN downstream).
//
// This is the ONLY place that does dynamic-shape-to-typed-shape narrowing —
// downstream builders never need `as number` or `?? default`.
export function buildPrimitiveParams(slug: string, raw: PropsState): PrimitiveParams {
  const num = (k: string): number => {
    const v = raw[k]

    if (typeof v !== 'number') {
      throw new Error(
        `primitive '${slug}': missing or non-number param '${k}' (got ${typeof v}). Check @/data/primitives.ts.`,
      )
    }

    return v
  }

  switch (slug) {
    case 'color-ramp':
      return { slug, position: num('position') }
    case 'noise':
      return { slug, scale: num('scale'), speed: num('speed') }
    case 'fbm':
      return {
        slug,
        scale: num('scale'),
        speed: num('speed'),
        octaves: num('octaves'),
        lacunarity: num('lacunarity'),
        gain: num('gain'),
      }
    case 'voronoi':
      return { slug, scale: num('scale'), speed: num('speed') }
    case 'quantize':
      return { slug, bins: num('bins') }
    case 'sdf-circle':
      return { slug, radius: num('radius'), cx: num('cx'), cy: num('cy') }
    case 'displace':
      return { slug, x: num('x'), y: num('y') }
    case 'cursor-ripple':
      return {
        slug,
        amplitude: num('amplitude'),
        falloff: num('falloff'),
        speed: num('speed'),
      }
    case 'time':
      return { slug: 'time' }
    default:
      throw new Error(`Unknown primitive slug: '${slug}'`)
  }
}

// Structural key for PrimitiveMesh: param values are read directly into the
// TSL chain at build time (instead of being plumbed through uniforms with the
// useAnimatableUniform hook), so the chain has to rebuild when any of them
// change. Per-control AnimatableProp hooks would require conditional hook
// calls — illegal under the rules of hooks. Remount-on-key is the simpler,
// gotcha-#12-safe answer for the prototype demo.
//
// JSON.stringify with an explicit sorted key list keeps the output
// deterministic across runtimes (object key order is implementation-defined
// in older specs).
const buildStructuralKey = (primitive: PrimitiveParams): string =>
  JSON.stringify(primitive, Object.keys(primitive).sort())

// === Primitive demo builders ===
// One per variant. Each takes its narrowly-typed slice of PrimitiveParams
// (and `staticCursor` where needed) and returns the colorNode for the demo.
// No `?? default` and no `as`-casts — the variant tells us every field exists
// with the right type.

function buildColorRamp(p: ParamsFor<'color-ramp'>): ShaderNodeObject<Node> {
  const stops: ColorRampStop[] = [
    { color: vec3(1, 0.4, 0.4), position: 0 },
    { color: vec3(0.4, 1, 0.4), position: 0.5 },
    { color: vec3(0.4, 0.4, 1), position: 1 },
  ]
  // Vary t across the canvas so the user can SEE the gradient AND scrub
  // a "cursor" (the visualized sample line) by moving the position
  // slider. We render the full ramp (uv.x) underneath, then overlay a
  // brighter readout where uv.x ≈ position.
  const baseColor = colorRamp(uv().x, stops)
  const distFromMarker = uv().x.sub(p.position).abs()
  const marker = smoothstep(0.01, 0, distFromMarker)
  // Brighten the band at the marker position so the user can see the
  // sampled color "pin" against the background ramp.
  const lit = mix(baseColor, vec3(1, 1, 1), marker.mul(0.6))

  return vec4(lit, 1)
}

function buildNoise(p: ParamsFor<'noise'>): ShaderNodeObject<Node> {
  const t = time.mul(p.speed)
  const pNode = uv().mul(p.scale).add(vec2(t, t))
  const n = noise(pNode)
  // noise returns ~[-1, 1]; map to [0, 1] grayscale.
  const g = n.mul(0.5).add(0.5).clamp(0, 1)

  return vec4(g, g, g, 1)
}

function buildFbm(p: ParamsFor<'fbm'>): ShaderNodeObject<Node> {
  const t = time.mul(p.speed)
  const pNode = uv().mul(p.scale).add(vec2(t, t))
  const f = fbm(pNode, { octaves: p.octaves, lacunarity: p.lacunarity, gain: p.gain })
  const g = f.mul(0.5).add(0.5).clamp(0, 1)

  return vec4(g, g, g, 1)
}

function buildVoronoi(p: ParamsFor<'voronoi'>): ShaderNodeObject<Node> {
  const t = time.mul(p.speed)
  const pNode = uv().mul(p.scale).add(vec2(t, t))
  const v = voronoi(pNode)
  // voronoi (mx_worley_noise_float) is roughly [0, 1]; clamp to be safe.
  const g = v.clamp(0, 1)

  return vec4(g, g, g, 1)
}

function buildQuantize(p: ParamsFor<'quantize'>): ShaderNodeObject<Node> {
  // bins is a JS number we read directly. Source uv.x through quantize(...)
  // to show discrete bands. Color via a fixed 3-stop ramp so the bins read
  // as colors, not just gray strips.
  const bins = Math.max(2, Math.round(p.bins))
  const q = quantize(uv().x, bins)
  const stops: ColorRampStop[] = [
    { color: vec3(0.15, 0.2, 0.4), position: 0 },
    { color: vec3(0.6, 0.4, 0.9), position: 0.5 },
    { color: vec3(1, 0.7, 0.4), position: 1 },
  ]
  const c = colorRamp(q, stops)

  return vec4(c, 1)
}

function buildSdfCircle(p: ParamsFor<'sdf-circle'>): ShaderNodeObject<Node> {
  // SDF translation: rendering at +center evaluates at (p - center).
  // pNode is uv()-derived, center is a JS-number vec2 baked into the chain.
  const pNode = uv().sub(vec2(p.cx, p.cy))
  const sdf = sdfCircle(pNode, p.radius)
  // Soft-edged disk via smoothstep across [+aa, -aa].
  const aa = 0.005
  const mask = smoothstep(aa, -aa, sdf)
  // Render disk in white, background in dark blue.
  const c = mix(vec3(0.05, 0.05, 0.1), vec3(1, 1, 1), mask)

  return vec4(c, 1)
}

function buildDisplace(p: ParamsFor<'displace'>): ShaderNodeObject<Node> {
  // displace has no inherent visual without something to sample at the
  // displaced point. We sample noise(uv * 4 + animated_t) at the
  // displaced UV so the user can SEE the offset shift the noise field.
  // The animated_t keeps it visually alive even at zero displacement.
  const t = time.mul(0.2)
  const dUv = displace(uv(), vec2(p.x, p.y))
  const samplePoint = dUv.mul(4).add(vec2(t, t))
  const n = noise(samplePoint)
  const g = n.mul(0.5).add(0.5).clamp(0, 1)

  return vec4(g, g, g, 1)
}

function buildCursorRipple(
  p: ParamsFor<'cursor-ripple'>,
  staticCursor: Parameters<typeof cursorRipple>[1],
): ShaderNodeObject<Node> {
  // Hardcoded cursor at (0.5, 0.5) — see staticCursor in PrimitiveMesh. Real
  // cursor wiring is orthogonal to demonstrating the primitive's shape; we
  // just need to show the ripple pattern.
  //
  // Map 'falloff' (1..10, higher=sharper) onto cursorRipple's `reach`
  // (radius beyond which ripple decays) and `frequency` (ring spacing).
  // High falloff → small reach + high frequency = many tight rings.
  const reach = 1 / p.falloff
  const frequency = p.falloff * 8
  const ripple = cursorRipple(uv(), staticCursor, {
    amplitude: p.amplitude,
    frequency,
    reach,
    speed: p.speed * 6,
  })
  // ripple is in roughly [-amplitude, +amplitude]; map to [0, 1] gray.
  const g = ripple
    .div(p.amplitude * 2 + 0.0001)
    .add(0.5)
    .clamp(0, 1)

  return vec4(g, g, g, 1)
}

function buildTime(): ShaderNodeObject<Node> {
  // No controls. sin(time * 2) → [-1, 1] → grayscale pulse.
  const v = sin(time.mul(2)).mul(0.5).add(0.5)

  return vec4(v, v, v, 1)
}

export function PrimitiveScene({ primitive }: PrimitiveSceneProps) {
  const remountKey = buildStructuralKey(primitive)

  return (
    <ShaderScene>
      <PrimitiveMesh key={remountKey} primitive={primitive} />
    </ShaderScene>
  )
}

function PrimitiveMesh({ primitive }: PrimitiveSceneProps) {
  const ctx = useShaderContext()

  // Static cursor uniform for the cursor-ripple demo. Hardcoded to (0.5, 0.5)
  // so the ripple emits from the center — pulling in real cursor tracking
  // (useCursor + plumbing to a uniform) would balloon this prototype with
  // wiring orthogonal to "show the primitive's signature." Kept stable across
  // renders so the chain references the same uniform identity.
  const staticCursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const staticCursor = useMemo(() => uniform(staticCursorVec), [staticCursorVec])

  useEffect(() => {
    if (!ctx) return

    let colorNode: ShaderNodeObject<Node>

    switch (primitive.slug) {
      case 'color-ramp':
        colorNode = buildColorRamp(primitive)
        break
      case 'noise':
        colorNode = buildNoise(primitive)
        break
      case 'fbm':
        colorNode = buildFbm(primitive)
        break
      case 'voronoi':
        colorNode = buildVoronoi(primitive)
        break
      case 'quantize':
        colorNode = buildQuantize(primitive)
        break
      case 'sdf-circle':
        colorNode = buildSdfCircle(primitive)
        break
      case 'displace':
        colorNode = buildDisplace(primitive)
        break
      case 'cursor-ripple':
        colorNode = buildCursorRipple(primitive, staticCursor)
        break
      case 'time':
        colorNode = buildTime()
        break
      default: {
        // Exhaustiveness check: if a new variant is added to PrimitiveParams
        // and not handled above, `primitive` here is not `never` and TS errors.
        const _exhaustive: never = primitive

        throw new Error(`Unhandled primitive variant: ${JSON.stringify(_exhaustive)}`)
      }
    }

    const material = new MeshBasicNodeMaterial()

    material.colorNode = colorNode

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)

    ctx.scene.add(mesh)

    return () => {
      ctx.scene.remove(mesh)
      // three's WebGPURenderer can throw inside `material.dispose()` during
      // rapid rebuilds (Nodes bookkeeping race). Mirror the registry pattern:
      // swallow the dispose error, GPU resources reap on renderer dispose.
      try {
        material.dispose()
      } catch {
        /* benign during rebuild */
      }
      try {
        mesh.geometry.dispose()
      } catch {
        /* same */
      }
    }
  }, [ctx, primitive, staticCursor])

  return null
}
