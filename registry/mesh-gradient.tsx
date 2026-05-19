// registry/mesh-gradient.tsx
'use client'

import { useEffect, useMemo } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'
import { vec2, vec3, vec4, length, max, min, time, uv, uniform } from '@lovo/matter'
import { noise } from '@lovo/matter'
import {
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  useResize,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'

export type MeshPoint = readonly [number, number]

export interface MeshGradientProps {
  colors?: AnimatableProp<string[]>
  /** 'auto' uses corner-spread positions; an array provides explicit points. */
  points?: 'auto' | readonly MeshPoint[]
  speed?: AnimatableProp<number>
  blur?: AnimatableProp<number>
  /**
   * Cursor pull strength as a 0..1 lerp factor. 0 = no pull, 1 = points
   * snap to cursor (collapsing the blend to a single color at the pointer).
   * Default 0.15 — visible but not dominating. Only consumed when
   * `interactive` is truthy or `inputs.cursor` is provided.
   */
  strength?: AnimatableProp<number>
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
}

const DEFAULT_COLORS = ['#ff61a6', '#61a6ff', '#61ffa6', '#ffd861']

// `blur` exponent default tuned 2026-05-07 in /dev/mesh-gradient-playground.
// At 0.4 the four corner color points stay distinct enough to read as separate
// "sources" without being so localized that the blend looks tiled. Higher
// values (>1) read mushy; lower values (<0.2) read like sharp gradients.
const DEFAULT_BLUR = 0.4

const hex = (s: string): readonly [number, number, number] => {
  const c = s.replace('#', '')
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ]
}

const isSignalLike = (v: unknown): v is { get(): unknown } =>
  typeof v === 'object' && v !== null && typeof (v as { get?: unknown }).get === 'function'

const resolveColors = (prop: AnimatableProp<string[]> | undefined): string[] => {
  if (prop === undefined) return DEFAULT_COLORS
  if (isSignalLike(prop)) return (prop as { get(): string[] }).get()
  return prop
}

const autoPointsFor = (n: number): readonly MeshPoint[] => {
  // Place points on a roughly even ring + center for n>=5; corners for n<=4.
  if (n <= 4) {
    const corners: readonly MeshPoint[] = [
      [0.0, 0.0],
      [1.0, 0.0],
      [1.0, 1.0],
      [0.0, 1.0],
    ]
    return corners.slice(0, Math.max(n, 1))
  }
  const out: MeshPoint[] = []
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2
    out.push([0.5 + 0.4 * Math.cos(theta), 0.5 + 0.4 * Math.sin(theta)])
  }
  return out
}

export function MeshGradient(props: MeshGradientProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)
  const resize = useResize()

  const colors = resolveColors(props.colors)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0.3)
  const blurUniform = useAnimatableUniform<number>(props.blur ?? DEFAULT_BLUR)
  const strengthUniform = useAnimatableUniform<number>(props.strength ?? 0.15)

  const points = useMemo(() => {
    if (props.points === undefined || props.points === 'auto') return autoPointsFor(colors.length)
    return props.points
  }, [props.points, colors.length])

  // Cursor uniform — UV-space, y flipped from DOM-space. useCursor()'s signal
  // is already canvas-rect-normalized centrally (matter PR 0e09e90), so we
  // only need the y-flip here.
  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])
  useEffect(() => {
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    cursorVec.set(0.5, 0.5)
    return undefined
  }, [cursor, cursorVec])

  // Resolution uniform — CSS pixels of the canvas. Seed from resize.get()
  // immediately so the GPU sees real values on first render even before any
  // ResizeObserver tick fires. Pattern mirrors DotField (registry/dot-field.tsx).
  // Initial (1920,1080) is a sane large default rather than (1,1): with (1,1)
  // the resolution-aware epsilon (length(res)*0.7071*-1) collapses to ~1.0 in
  // UV space for one frame, producing a washed-out flash before the resize
  // effect seeds the real canvas dims. Real desktop canvases will overwrite
  // this immediately; mobile users start with a closer estimate.
  const resVec = useMemo(() => new Vector2(1920, 1080), [])
  const resUniform = useMemo(() => uniform(resVec), [resVec])
  useEffect(() => {
    const [w, h] = resize.get()
    if (w > 0 && h > 0) {
      resVec.set(w, h)
    }
    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2))
  }, [resize, resVec])

  useEffect(() => {
    if (!ctx) return

    // Resolution-aware corner epsilon. Without this the .add(0.001) UV-space
    // bias makes corner sharpness resolution-dependent (~1px at 1080p, ~2px
    // at 4K). length(resUniform) is the pixel-space diagonal; multiplying by
    // 1/sqrt(2) ≈ 0.7071 gives the "mean dimension" — same pattern DotField
    // uses for isotropic reach. length(...) is a function-call result (not a
    // uniform receiver), so chaining .mul/.pow off it is gotcha-#12-clean.
    const meanResPx = length(resUniform).mul(0.7071)
    // epsilonUv = 1 / meanResPx ≈ one diagonal-mean pixel in UV space —
    // slightly tighter than 1px on the long axis, slightly looser on the
    // short axis. Same isotropic-reach trick DotField uses.
    const epsilonUv = meanResPx.pow(-1)

    // vec2(0).x is a TSL literal scalar — chain rooted here means blurUniform
    // only appears as an argument, never as a chain receiver (gotcha #12).
    const zeroScalar = (vec2(0) as ShaderNodeObject<Node>).x
    // Floor blur at 0.05 to avoid 1/d^∞ when a user passes blur near 0. The
    // max is computed inside TSL so live updates flow without rebuild.
    const safeBlur = max(blurUniform as never, 0.05) as ShaderNodeObject<Node>
    // negInvBlur = -1 / safeBlur. zeroScalar.add(safeBlur) anchors the chain
    // in the literal. .pow(-1) inverts; .mul(-1) negates. Live `blur` updates
    // flow because both pow operands flow through uniforms — no rebuild.
    const negInvBlur = zeroScalar.add(safeBlur).pow(-1).mul(-1)

    let totalWeight: ShaderNodeObject<Node> | null = null
    let weightedSum: ShaderNodeObject<Node> | null = null

    for (let i = 0; i < points.length; i++) {
      const bp = points[i]!
      // Per-point jitter: position drifts via noise(vec2(i, time*speed)) * 0.08.
      // Chains rooted in `time` (TSL built-in node) and vec2(...) literals —
      // speedUniform/blurUniform only ever appear as arguments (gotcha #12).
      const tNode = (time as ShaderNodeObject<Node>).mul(speedUniform as unknown as number)
      const nx = noise(vec2(i + 0.13, tNode)) as ShaderNodeObject<Node>
      const ny = noise(vec2(i + 0.79, tNode)) as ShaderNodeObject<Node>
      let point = vec2(bp[0], bp[1]).add(vec2(nx.mul(0.08), ny.mul(0.08))) as ShaderNodeObject<Node>

      // If interactive, all points ease toward cursor with a fixed strength.
      // Spec §5.2 says "nearest" point pulls; for the multi-point inverse-
      // distance field, equal pull on all points is visually equivalent
      // within typical cursor reach and simpler to implement on the GPU.
      // Promotable to per-point nearest-only weighting in v2.
      if (cursor) {
        // (cursor - point) = -(point - cursor). Chain rooted in `point`
        // (vec2-derived), uniform passed as the .sub argument (gotcha #12).
        const cursorPull = (point as ShaderNodeObject<Node>).sub(cursorUniform).mul(-1)
        // strengthUniform is the user's lerp factor (default 0.15 = 15%
        // toward cursor). Chain rooted in cursorPull (uv-derived), uniform
        // as .mul argument. Live updates flow without rebuild.
        point = point.add(
          cursorPull.mul(strengthUniform as unknown as number),
        ) as ShaderNodeObject<Node>
      }

      // d = length(uv() - point) — uv-rooted chain, `point` as arg
      // (gotcha #12). Add resolution-aware epsilon so the central pixel of
      // each point doesn't divide by zero — equivalent to ~1 CSS px.
      const d = length(uv().sub(point)).add(epsilonUv as never) as ShaderNodeObject<Node>
      // weight = d^(-1/blur)  ==  1 / d^(1/blur). negInvBlur is built above
      // as a TSL chain, so live `blur` updates flow without rebuild.
      // Cap the weight at 1e30 so float32 doesn't overflow to Infinity at
      // the corner singularity for small `blur` values: at blur=0.05 the
      // raw weight reaches ~10^66 within ~1px of the corner, overflowing
      // to Infinity, which propagates as NaN through the weighted-sum
      // normalization and renders as black ellipses at each corner.
      // 10^30 is comfortably below float32 max (~3.4e38) and still leaves
      // the corner color visually dominant — about 10^29 larger than
      // typical inter-corner weights.
      const weight = min(d.pow(negInvBlur as never), 1e30) as ShaderNodeObject<Node>

      const [r, g, b] = hex(colors[i] ?? colors[colors.length - 1] ?? '#ffffff')
      const contribution = (vec3(r, g, b) as ShaderNodeObject<Node>).mul(weight)

      if (totalWeight === null) {
        totalWeight = weight
        weightedSum = contribution
      } else {
        totalWeight = totalWeight.add(weight) as ShaderNodeObject<Node>
        weightedSum = (weightedSum as ShaderNodeObject<Node>).add(
          contribution,
        ) as ShaderNodeObject<Node>
      }
    }

    const finalColor = (weightedSum as ShaderNodeObject<Node>).div(
      totalWeight as ShaderNodeObject<Node>,
    ) as ShaderNodeObject<Node>

    const material = new MeshBasicNodeMaterial()
    // vec4(vec3, scalar) is supported by TSL's ConvertType signature
    // (DotField and Waves both use it).
    material.colorNode = vec4(finalColor as never, 1) as never

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      // three's WebGPURenderer can throw inside `material.dispose()` when the
      // renderer's Nodes bookkeeping has already cleaned up the node tree
      // (typically during rapid rebuild cycles). Swallowing the dispose error
      // prevents a page crash; the underlying GPU resources will be reaped
      // when the parent renderer is disposed at unmount.
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
  }, [
    ctx,
    colors.join('|'),
    points,
    speedUniform,
    blurUniform,
    strengthUniform,
    cursor,
    cursorUniform,
    resUniform,
  ])

  return null
}
