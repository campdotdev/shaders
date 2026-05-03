'use client'

import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { Mesh, PlaneGeometry } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { vec3, vec2, mix, length, uv, time } from '@lovo/matter'
import { colorRamp, type ColorRampStop } from '@lovo/matter'
import {
  MatterScene,
  useMatterContext,
  useAnimatableUniform,
  useCursor,
  FallbackBoundary,
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
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
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

function LinearGradientMesh(props: LinearGradientProps) {
  const ctx = useMatterContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive ? cursorAuto : null)

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

  useEffect(() => {
    if (!ctx) return

    const stops: ColorRampStop[] = colors.map((hex, i) => {
      const [r, g, b] = hexToVec3(hex)
      return {
        color: vec3(r, g, b),
        position: i / Math.max(colors.length - 1, 1),
      }
    })

    const focal = (focalUniform as unknown as { value: { x: number; y: number } | readonly [number, number] }).value
    const focalX = Array.isArray(focal) ? focal[0] : (focal as { x: number }).x
    const focalY = Array.isArray(focal) ? focal[1] : (focal as { y: number }).y

    let tNode
    if (props.variant === 'radial') {
      // Radial: t is distance from focalPoint (DOM y inverted to UV y).
      const focalVec = vec2(focalX, 1 - focalY)
      tNode = length(uv().sub(focalVec))
    } else {
      // Linear: project uv along the rotation direction. angle in degrees → radians.
      const angleRad = (angleUniform as unknown as { value: number }).value * (Math.PI / 180)
      const dirX = Math.cos(angleRad)
      const dirY = Math.sin(angleRad)
      tNode = uv().sub(vec2(0.5, 0.5)).dot(vec2(dirX, dirY)).add(0.5)
    }

    // Cursor influence: deliberately a no-op for the v1 visual. The
    // architecture (interactive prop, useCursor, inputs prop) is real
    // and tested in the playground harness; richer cursor-driven warping
    // ships in M3 alongside DotField / Aurora / cursorRipple.
    void cursor

    // Animate the gradient drift via TSL `time` uniform.
    const speedScalar = (speedUniform as unknown as { value: number }).value
    const tAnimated = tNode.add(time.mul(speedScalar))

    const material = new MeshBasicNodeMaterial()
    material.colorNode = colorRamp(tAnimated, stops) as unknown as MeshBasicNodeMaterial['colorNode']

    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    ctx.scene.add(mesh)
    return () => {
      ctx.scene.remove(mesh)
      material.dispose()
      mesh.geometry.dispose()
    }
    // Re-run when structural inputs change. Animatable uniforms are mutated
    // in place and don't re-trigger this effect.
  }, [ctx, props.variant, colors.join('|'), cursor, angleUniform, speedUniform, focalUniform])

  return null
}

function DefaultFallback({ colors, angle }: { colors: string[]; angle: number }) {
  const stops = colors.join(', ')
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `linear-gradient(${angle}deg, ${stops})`,
      }}
    />
  )
}

export function LinearGradient(props: LinearGradientProps) {
  const colorsForFallback = resolveColors(props.colors)
  const angleForFallback = typeof props.angle === 'number' ? props.angle : 0

  return (
    <FallbackBoundary
      fallback={
        props.fallback ?? <DefaultFallback colors={colorsForFallback} angle={angleForFallback} />
      }
    >
      <MatterScene className={props.className} style={props.style}>
        <LinearGradientMesh {...props} />
      </MatterScene>
    </FallbackBoundary>
  )
}
