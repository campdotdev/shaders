// registry/aurora.tsx
'use client'

import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'
import { vec2, vec3, vec4, length, smoothstep, time, uv, uniform } from '@lovo/matter'
import { fbm, displace, colorRamp, type ColorRampStop } from '@lovo/matter'
import {
  MatterScene,
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  FallbackBoundary,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'

export interface AuroraProps {
  colors?: AnimatableProp<string[]>
  speed?: AnimatableProp<number>
  intensity?: AnimatableProp<number>
  /** Cursor amplification ceiling. 0 disables; 1 = 2x flow at cursor; 3 = 4x. */
  cursorStrength?: AnimatableProp<number>
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
}

const DEFAULT_COLORS = ['#7b61ff', '#5fc7ff', '#ff61a6']

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const c = hex.replace('#', '')
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

function AuroraMesh(props: AuroraProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)

  const colors = resolveColors(props.colors)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0.4)
  const intensityUniform = useAnimatableUniform<number>(props.intensity ?? 1)
  const cursorStrengthUniform = useAnimatableUniform<number>(props.cursorStrength ?? 1)

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

  useEffect(() => {
    if (!ctx) return

    const stops: ColorRampStop[] = colors.map((hex, i) => {
      const [r, g, b] = hexToVec3(hex)
      return { color: vec3(r, g, b), position: i / Math.max(colors.length - 1, 1) }
    })

    // 1. FBM displacement field, scaled by speed and intensity.
    //    flow = fbm(uv * 0.5 + time * speed * 0.1)
    //    displaced uv = displace(uv, vec2(flow * intensity, 0))
    // Chain rooted in uv() / time (TSL nodes), uniforms passed only as args
    // (gotcha #12: chained-on-uniform silently produces wrong GPU values).
    //
    // The trailing `.mul(0.1)` is an internal time-rate scaling so that the
    // user-facing `speed` prop sits in a calm, aurora-like cadence range. At
    // speed=0.4 (default) the effective FBM scroll rate is 0.04 noise units/sec,
    // traversing one feature in ~25s — calm. Without the 0.1× factor, speed=0.4
    // traversed a feature in ~2.5s, which felt hectic per stop-and-play feedback.
    const tNode = (time as ShaderNodeObject<Node>)
      .mul(speedUniform as unknown as number)
      .mul(0.1)
    const sampleP = (uv() as ShaderNodeObject<Node>)
      .mul(0.5)
      .add(vec2(tNode, tNode)) as ShaderNodeObject<Node>
    const flow = fbm(sampleP, { octaves: 4 }) as ShaderNodeObject<Node>

    // 2. Cursor amplification: a 1..(1 + cursorStrength)x multiplier on the
    //    flow magnitude near the cursor. Isotropic falloff via smoothstep over
    //    uv-distance.
    let amplified = flow
    if (cursor) {
      const d = length(uv().sub(cursorUniform))
      // smoothstep(0.3, 0, d): 1 at the cursor, 0 at uv-distance >= 0.3.
      // 0.3 ≈ 30% of the canvas's shorter edge in UV space.
      const amp = smoothstep(0.3, 0, d as never) as ShaderNodeObject<Node>
      // 1 + amp * cursorStrength: 1x at the edge of reach,
      // (1 + cursorStrength)x at the cursor itself. cursorStrength=0 disables.
      const ampScaled = amp.mul(cursorStrengthUniform as unknown as number) as ShaderNodeObject<Node>
      amplified = flow.mul(ampScaled.add(1) as ShaderNodeObject<Node>) as ShaderNodeObject<Node>
    }

    // x-only displacement: bands are vertical, so warping x produces the
    // characteristic "flowing band" look. y is left untouched.
    const displacement = vec2(amplified.mul(intensityUniform as unknown as number), 0)
    const dUv = displace(uv(), displacement as never) as ShaderNodeObject<Node>

    // 3. Vertical band gradient via colorRamp on the displaced x.
    //    A1 fix: colorRamp samples on `dUv.x` (NOT `dUv.y`) because bands are
    //    vertical and displacement is x-only — sampling on y would be a no-op
    //    visually since dUv.y === uv().y, leaving the bands static.
    const band = (dUv.x as ShaderNodeObject<Node>).clamp(0, 1)
    const colorAtUv = colorRamp(band as never, stops) as ShaderNodeObject<Node>

    const material = new MeshBasicNodeMaterial()
    // A2 fix: use vec4(vec3, scalar) overload instead of rebuilding via three
    // swizzles — same pattern as dot-field / waves / mesh-gradient.
    material.colorNode = vec4(colorAtUv as never, 1) as never

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      // three's WebGPURenderer can throw inside `material.dispose()` when the
      // renderer's Nodes bookkeeping has already cleaned up the node tree
      // (typically during rapid rebuild cycles). Swallowing the dispose error
      // prevents a page crash; the underlying GPU resources will be reaped
      // when the parent renderer is disposed at unmount.
      try { material.dispose() } catch { /* benign during rebuild */ }
      try { mesh.geometry.dispose() } catch { /* same */ }
    }
  }, [ctx, colors.join('|'), speedUniform, intensityUniform, cursorStrengthUniform, cursor, cursorUniform])

  return null
}

function DefaultFallback({ colors }: { colors: string[] }) {
  // Three stacked CSS radial gradients with blur per spec §5.2 line 463.
  const layers = colors.slice(0, 3).map((c, i) => {
    const offsets = ['20% 30%', '60% 50%', '80% 80%'][i] ?? '50% 50%'
    return `radial-gradient(circle at ${offsets}, ${c} 0%, transparent 50%)`
  })
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: layers.join(', '),
        filter: 'blur(40px)',
      }}
    />
  )
}

export function Aurora(props: AuroraProps) {
  const colors = resolveColors(props.colors)
  return (
    <FallbackBoundary fallback={props.fallback ?? <DefaultFallback colors={colors} />}>
      <MatterScene className={props.className} style={props.style}>
        <AuroraMesh {...props} />
      </MatterScene>
    </FallbackBoundary>
  )
}
