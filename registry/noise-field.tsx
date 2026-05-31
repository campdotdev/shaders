// registry/noise-field.tsx
'use client'

import { useEffect, useMemo } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import type { ShaderNodeObject } from 'three/tsl'
import { vec2, vec3, uv, uniform } from 'three/tsl'
import { time, colorRamp, fbm, voronoi, quantize, type ColorRampStop } from '@lovo/matter'
import {
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'

export interface NoiseFieldProps {
  scale?: AnimatableProp<number>
  speed?: AnimatableProp<number>
  colors?: AnimatableProp<string[]>
  octaves?: number // JS-side; baked into TSL fragment at mount.
  variant?: 'organic' | 'cellular' | 'grid'
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
}

const DEFAULT_COLORS = ['#131614', '#E7E9E7']  // palette.gray[1] → palette.gray[11]
const GRID_STEPS = 6 // hardcoded for variant="grid"; promotable to a prop in v2.

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [r, g, b]
}

const isSignalLike = (v: unknown): v is { get(): unknown } =>
  typeof v === 'object' && v !== null && typeof (v as { get?: unknown }).get === 'function'

const resolveColors = (prop: AnimatableProp<string[]> | undefined): string[] => {
  if (prop === undefined) return DEFAULT_COLORS
  if (isSignalLike(prop)) return (prop as { get(): string[] }).get()
  return prop
}

export function NoiseField(props: NoiseFieldProps) {
  const ctx = useMatterContext()
  const colors = resolveColors(props.colors)
  const octaves = props.octaves ?? 4
  const variant = props.variant ?? 'organic'

  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)

  const scaleUniform = useAnimatableUniform<number>(props.scale ?? 1)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0.5)

  // Cursor wiring is kept here as future-enhancement scaffolding (the spec
  // marks UV displacement near cursor as optional). cursorVec is mutated in
  // place from the cursor signal so the GPU sees the new value every frame
  // when the TSL fragment eventually consumes cursorUniform. Today the TSL
  // path doesn't read it — that's fine, the wiring is silent until used.
  // Keeping it declared documents the contract with the cursor signal.
  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  // TODO: when cursor-displace wires up, consume cursorUniform in the TSL
  // chain (root from uv()/vec2, pass cursorUniform as arg per gotcha #12)
  // and drop this eslint-disable.
  // oxlint-disable-next-line @typescript-eslint/no-unused-vars
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])
  useEffect(() => {
    if (cursor) {
      return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    }
    cursorVec.set(0.5, 0.5)
    return undefined
  }, [cursor, cursorVec])

  useEffect(() => {
    if (!ctx) return

    const stops: ColorRampStop[] = colors.map((hex, i) => {
      const [r, g, b] = hexToVec3(hex)
      return {
        color: vec3(r, g, b),
        position: i / Math.max(colors.length - 1, 1),
      }
    })

    // Build the input UV starting from `uv()` and pass uniforms in as args
    // (gotcha #12). scaleUniform is the only animatable on the UV path here;
    // cursor-displace is a future enhancement (see cursor wiring above).
    const baseUv = uv().mul(scaleUniform as unknown as number)
    // Pre-compute the time-driven offset once and reuse on both UV axes —
    // identical scrolling on x and y reads as the noise field "drifting"
    // diagonally without per-axis variation, which is the desired feel for
    // a uniform background pattern.
    const tOff = (time as ShaderNodeObject<Node>).mul(speedUniform as unknown as number)
    const animatedUv = baseUv.add(vec2(tOff, tOff))

    let t
    if (variant === 'cellular') {
      t = voronoi(animatedUv)
    } else if (variant === 'grid') {
      const raw = fbm(animatedUv, { octaves })
      const norm = (raw as unknown as { add(n: number): { mul(n: number): unknown } })
        .add(1)
        .mul(0.5)
      t = quantize(norm as never, GRID_STEPS)
    } else {
      const raw = fbm(animatedUv, { octaves })
      t = (raw as unknown as { add(n: number): { mul(n: number): unknown } }).add(1).mul(0.5)
    }

    const material = new MeshBasicNodeMaterial()
    material.colorNode = colorRamp(t as never, stops) as never
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      // three's WebGPURenderer can throw inside `material.dispose()` when
      // the renderer's Nodes bookkeeping has already cleaned up the node
      // tree (typically during rapid rebuild cycles). Swallowing the
      // dispose error prevents a page crash; the underlying GPU resources
      // will be reaped when the parent renderer is disposed at unmount.
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
  }, [ctx, colors.join('|'), octaves, variant, scaleUniform, speedUniform])

  return null
}
