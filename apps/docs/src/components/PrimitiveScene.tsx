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
import { Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'

import { addPlaneMesh } from '@/lib/meshUtils'

import type { PropsState } from './PropsPlayground'

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

const buildStructuralKey = (primitive: PrimitiveParams): string =>
  JSON.stringify(primitive, Object.keys(primitive).sort())

// === Primitive demo builders ===

function buildColorRamp(p: ParamsFor<'color-ramp'>): ShaderNodeObject<Node> {
  const stops: ColorRampStop[] = [
    { color: vec3(1, 0.4, 0.4), position: 0 },
    { color: vec3(0.4, 1, 0.4), position: 0.5 },
    { color: vec3(0.4, 0.4, 1), position: 1 },
  ]

  const baseColor = colorRamp(uv().x, stops)
  const distFromMarker = uv().x.sub(p.position).abs()
  const marker = smoothstep(0.01, 0, distFromMarker)

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
  const f = fbm(pNode, {
    octaves: p.octaves,
    lacunarity: p.lacunarity,
    gain: p.gain,
  })
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
  const pNode = uv().sub(vec2(p.cx, p.cy))
  const sdf = sdfCircle(pNode, p.radius)
  const aa = 0.005
  const mask = smoothstep(aa, -aa, sdf)
  const c = mix(vec3(0.05, 0.05, 0.1), vec3(1, 1, 1), mask)

  return vec4(c, 1)
}

function buildDisplace(p: ParamsFor<'displace'>): ShaderNodeObject<Node> {
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
  const reach = 1 / p.falloff
  const frequency = p.falloff * 8
  const ripple = cursorRipple(uv(), staticCursor, {
    amplitude: p.amplitude,
    frequency,
    reach,
    speed: p.speed * 6,
  })
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
        const _exhaustive: never = primitive

        throw new Error(`Unhandled primitive variant: ${JSON.stringify(_exhaustive)}`)
      }
    }

    return addPlaneMesh(ctx, colorNode)
  }, [ctx, primitive, staticCursor])

  return null
}
