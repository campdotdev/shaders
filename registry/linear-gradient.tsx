'use client'

import { useEffect, useMemo } from 'react'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import { vec3, vec2, mod, length, uv, uniform } from 'three/tsl'
import { time, colorRamp, type ColorRampStop } from '@lovo/matter'
import {
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  useStaticHint,
  type AnimatableProp,
  type CursorSignal,
} from '@lovo/matter-react'

export interface LinearGradientProps {
  colors?: AnimatableProp<string[]>
  angle?: AnimatableProp<number>
  variant?: 'linear' | 'radial'
  focalPoint?: AnimatableProp<readonly [number, number]>
  speed?: AnimatableProp<number>
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
}

const DEFAULT_COLORS = ['#ff7b72', '#7b9cff']

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

export function LinearGradient(props: LinearGradientProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)

  const isStatic = typeof props.speed === 'number' && props.speed === 0
  useStaticHint(isStatic)

  const colors = resolveColors(props.colors)

  // The angle/speed/focal props are animatable; bind them to uniforms.
  // In M1 these uniforms are read once at material-build time (snapshot
  // semantics) — fully live AnimatableProp semantics on these specific
  // props ship in M3 alongside the richer interactive components.
  const angleUniform = useAnimatableUniform<number>(props.angle ?? 0)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0)
  const focalUniform = useAnimatableUniform<readonly [number, number]>(
    props.focalPoint ?? [0.5, 0.5],
  )

  // Cursor uniform — a real Vector2 we mutate in place from the cursor
  // signal so the GPU sees the new value every frame without a remount.
  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])

  // Drive cursorVec from the cursor signal when interactive; otherwise
  // park it on the static focalPoint prop (or screen center). The TSL
  // math reads cursorUniform either way, so both modes use one path.
  // y is inverted: DOM y=0 is top, UV y=0 is bottom of the geometry.
  useEffect(() => {
    if (cursor) {
      return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    }
    const fp = props.focalPoint
    if (Array.isArray(fp)) {
      cursorVec.set(fp[0] ?? 0.5, 1 - (fp[1] ?? 0.5))
    } else {
      cursorVec.set(0.5, 0.5)
    }
    return undefined
  }, [cursor, cursorVec, props.focalPoint])

  useEffect(() => {
    if (!ctx) return

    const stops: ColorRampStop[] = colors.map((hex, i) => {
      const [r, g, b] = hexToVec3(hex)
      return {
        color: vec3(r, g, b),
        position: i / Math.max(colors.length - 1, 1),
      }
    })

    // The cursor uniform is consumed via `uv().sub(cursorUniform)` (the
    // arg form, not chained receiver) — this matches the playground
    // harness's working pattern. Chained .sub/.mul/.dot starting from a
    // raw uniform node didn't propagate the value through the GPU
    // pipeline reliably; the arg form does.
    let tNode
    if (props.variant === 'radial') {
      // Radial: t is distance from focal. When interactive, the focal
      // tracks the cursor (DOM-y already inverted in the change handler).
      tNode = length(uv().sub(cursorUniform))
    } else {
      // Linear: project (uv - cursor) along the gradient direction so
      // the bands flow toward where the cursor is.
      const angleRad = (angleUniform as unknown as { value: number }).value * (Math.PI / 180)
      const dirX = Math.cos(angleRad)
      const dirY = Math.sin(angleRad)
      tNode = uv().sub(cursorUniform).dot(vec2(dirX, dirY)).add(0.5)
    }

    // Animate the gradient drift via TSL `time`. A naive `mod(t, 1)` wraps
    // hard and shows a seam at the boundary. Use a triangle wave that
    // ping-pongs t between 0 and 1: 1 - |1 - mod(t, 2)|. Smooth, seamless.
    const speedScalar = (speedUniform as unknown as { value: number }).value
    const tAnimated =
      speedScalar === 0
        ? tNode
        : mod(tNode.add(time.mul(speedScalar)), 2)
            .sub(1)
            .abs()
            .oneMinus()

    const material = new MeshBasicNodeMaterial()
    material.colorNode = colorRamp(
      tAnimated,
      stops,
    ) as unknown as MeshBasicNodeMaterial['colorNode']

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
      } catch (err) {
        // Known benign three.js webgpu race during rapid material churn —
        // see CLAUDE.md gotchas. Demoted to debug so it doesn't spam logs.
        // oxlint-disable-next-line no-console
        console.debug('[LinearGradient] material.dispose ignored:', err)
      }
      try {
        mesh.geometry.dispose()
      } catch (err) {
        // oxlint-disable-next-line no-console
        console.debug('[LinearGradient] geometry.dispose ignored:', err)
      }
    }
    // Re-run when structural inputs change. Animatable uniforms (incl.
    // cursorUniform) are mutated in place and don't re-trigger this effect.
  }, [
    ctx,
    props.variant,
    colors.join('|'),
    cursor,
    angleUniform,
    speedUniform,
    focalUniform,
    cursorUniform,
  ])

  return null
}
