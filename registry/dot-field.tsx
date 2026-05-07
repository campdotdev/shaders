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
  // Initial (1920,1080) is a sane large default — the original (1,1) made
  // the tile math (`uv * res / spacing`) collapse to a near-zero range for
  // one frame, briefly hiding all dots until the resize effect seeded.
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

    // Cell→cursor in pixel space, computed once and reused for the influence
    // curve and the displacement direction. Root in cellCenterUv (uv-derived)
    // so the chain is gotcha-#12-clean: uniforms appear only as arguments.
    const cellToCursorPx = (cellCenterUv as ShaderNodeObject<Node>)
      .sub(cursorUniform)
      .mul(-1)
      .mul(resUniform)
    const distToCursorPx = length(cellToCursorPx)
    // Cursor influence: 1 at cursor, 0 at `reach` px away.
    const influence = smoothstep(reachUniform as never, 0, distToCursorPx as never)

    // Unit direction from cell toward cursor. Adding 0.001 to the divisor
    // avoids div-by-zero at the cursor itself; the influence weight forces
    // the offset to ~0 there anyway so the small bias is invisible.
    const dirToCursor = (cellToCursorPx as ShaderNodeObject<Node>).div(
      (distToCursorPx as ShaderNodeObject<Node>).add(0.001),
    )

    // Offset in CELL-LOCAL units. dirToCursor is a dimensionless unit vector,
    // so multiplying by the 0.4 cap means "shift up to 40% of a cell width
    // toward the cursor at peak influence × peak strength." Earlier this was
    // `pullDir = cell - cursor` (UV-space) without normalization — the offset
    // magnitude scaled with screen size, so on a 1000px canvas the visible
    // shift at default reach=100 / strength=1 was only a few pixels (you had
    // to max both sliders to see anything). Normalizing fixes the feel.
    const offset = (dirToCursor as ShaderNodeObject<Node>)
      .mul(influence as unknown as number)
      .mul(strengthUniform as unknown as number)
      .mul(0.4)
    // SDF translation: rendering a disk at +v means evaluating the SDF at
    // (p - v), not (p + v). `displace` is naive vector addition, so we
    // negate `offset` here — otherwise dots visibly push AWAY from the
    // cursor instead of pulling toward it.
    const displacedLocal = displace(
      cellLocal as never,
      (offset as ShaderNodeObject<Node>).mul(-1) as never,
    )

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
