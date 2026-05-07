// registry/dot-field.tsx
'use client'

import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'
import { vec2, vec3, vec4, mix, mod, length, smoothstep, uv, uniform } from '@lovo/matter'
import { sdfCircle, displace } from '@lovo/matter'
import {
  MatterScene,
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  useResize,
  FallbackBoundary,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'

export interface DotFieldProps {
  spacing?: AnimatableProp<number>
  dotSize?: AnimatableProp<number>
  color?: string
  reach?: AnimatableProp<number>
  strength?: AnimatableProp<number>
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
}

const DEFAULTS = { spacing: 30, dotSize: 2, color: '#888888', reach: 100, strength: 1 } as const

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [r, g, b]
}

function DotFieldMesh(props: DotFieldProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ?? true ? cursorAuto : null)
  const resize = useResize()

  const spacingUniform = useAnimatableUniform<number>(props.spacing ?? DEFAULTS.spacing)
  const dotSizeUniform = useAnimatableUniform<number>(props.dotSize ?? DEFAULTS.dotSize)
  const reachUniform = useAnimatableUniform<number>(props.reach ?? DEFAULTS.reach)
  const strengthUniform = useAnimatableUniform<number>(props.strength ?? DEFAULTS.strength)

  const [cr, cg, cb] = hexToVec3(props.color ?? DEFAULTS.color)

  // Cursor uniform — UV-space, y flipped from DOM-space.
  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])
  useEffect(() => {
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    cursorVec.set(0.5, 0.5)
    return undefined
  }, [cursor, cursorVec])

  // Resolution uniform — CSS pixels of the canvas. Seed from resize.get()
  // immediately so the GPU sees real values on first render even before any
  // ResizeObserver tick fires (the stub returns [0, 0, 1], which we ignore).
  // resize.on('change', ...) fires only on actual size deltas, not initial.
  const resVec = useMemo(() => new Vector2(1, 1), [])
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

    // Tile uv into cells of `spacing` CSS px. p = uv * resolution / spacing
    // gives each cell unit length 1 along the cell axes.
    const pxUv = uv()
      .mul(resUniform)
      .div(spacingUniform as unknown as number)
    // Cell-local coord recentered to [-0.5, 0.5] — input to the SDF.
    const cellLocal = mod(pxUv, 1).sub(vec2(0.5, 0.5))
    // Cell index (whole part) → cell-center in uv space (back-converted from
    // cell space). Used for the per-cell distance-to-cursor calculation.
    const cellIndex = pxUv.sub(mod(pxUv, 1))
    const cellCenterUv = cellIndex
      .add(vec2(0.5, 0.5))
      .mul(spacingUniform as unknown as number)
      .div(resUniform)

    // Distance from cell center to cursor — computed in PIXEL space so we can
    // compare directly against `reachUniform` (which is in CSS px). This also
    // keeps the chain rooted in `cellCenterUv` (a uv()-derived node) and only
    // uses uniforms as ARGUMENTS, per gotcha #12.
    const distToCursorPx = length(
      (cellCenterUv as ShaderNodeObject<Node>).sub(cursorUniform).mul(resUniform),
    )
    // Cursor influence: 1 at the cursor, 0 at `reach` px away.
    const influence = smoothstep(reachUniform as never, 0, distToCursorPx as never)

    // Pull direction = cursor - cellCenter. Computed as -(cellCenter - cursor)
    // so the chain roots in cellCenterUv (uv-derived) and the uniform is an
    // argument, again per gotcha #12.
    const pullDir = (cellCenterUv as ShaderNodeObject<Node>).sub(cursorUniform).mul(-1)

    // Offset the cell-local coord toward the cursor, scaled by influence and
    // strength. The 0.5 cap keeps the displaced point inside the cell so the
    // SDF circle stays renderable.
    const offset = pullDir
      .mul(influence as unknown as number)
      .mul(strengthUniform as unknown as number)
      .mul(0.5)
    const displacedLocal = displace(cellLocal as never, offset as never)

    // dotSize is in CSS px; convert to cell-local fraction:
    // radius = dotSize / (spacing * 2). Root this chain in vec2(0).x —
    // a TSL literal scalar — so dotSize/spacing appear only as ARGUMENTS,
    // not as chain receivers (gotcha #12: chain methods on raw uniform
    // nodes silently produce wrong GPU values).
    const zeroScalar = (vec2(0) as ShaderNodeObject<Node>).x
    const radius = zeroScalar
      .add(dotSizeUniform)
      .div(zeroScalar.add(spacingUniform).mul(2))
    const sdf = sdfCircle(displacedLocal, radius as never)
    // Soft edge: smoothstep across [+aa, -aa] so inside maps to 1 and the
    // boundary gets a subpixel falloff instead of an aliased step.
    const aa = 0.01
    const dotMask = smoothstep(aa, -aa, sdf as never)

    // Build the dot color once and reuse — the prior listing rebuilt the
    // mix() tree three times across the .x/.y/.z fields.
    const dotColor = mix(vec3(0, 0, 0), vec3(cr, cg, cb), dotMask as never)

    const material = new MeshBasicNodeMaterial()
    // vec4(vec3, scalar) is supported by TSL's ConvertType signature.
    material.colorNode = vec4(dotColor as never, dotMask as never) as never

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      try { material.dispose() } catch { /* benign during rebuild */ }
      try { mesh.geometry.dispose() } catch { /* same */ }
    }
  }, [
    ctx,
    cr, cg, cb,
    spacingUniform, dotSizeUniform, reachUniform, strengthUniform,
    cursorUniform, resUniform,
  ])

  return null
}

function DefaultFallback({ color, spacing }: { color: string; spacing: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1.5px)`,
        backgroundSize: `${spacing}px ${spacing}px`,
      }}
    />
  )
}

export function DotField(props: DotFieldProps) {
  const fallbackColor = typeof props.color === 'string' ? props.color : DEFAULTS.color
  const fallbackSpacing = typeof props.spacing === 'number' ? props.spacing : DEFAULTS.spacing
  return (
    <FallbackBoundary
      fallback={
        props.fallback ?? <DefaultFallback color={fallbackColor} spacing={fallbackSpacing} />
      }
    >
      <MatterScene className={props.className} style={props.style}>
        <DotFieldMesh {...props} />
      </MatterScene>
    </FallbackBoundary>
  )
}
