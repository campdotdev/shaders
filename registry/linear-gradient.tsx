'use client'

import { colorRamp, type ColorRampStop, time } from '@lovo/matter'
import {
  type AnimatableProp,
  type CursorSignal,
  useAnimatableUniform,
  useCursor,
  useShaderContext,
  useStaticHint,
} from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import type { ShaderNodeObject } from 'three/tsl'
import { length, mod, uniform, uv, vec2, vec3 } from 'three/tsl'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'

export interface LinearGradientProps {
  colors?: AnimatableProp<string[]>
  angle?: AnimatableProp<number>
  variant?: 'linear' | 'radial'
  focalPoint?: AnimatableProp<readonly [number, number]>
  speed?: AnimatableProp<number>
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
}

const DEFAULT_COLORS = ['#d9f384', '#00ab34']

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255

  return [r, g, b]
}

const isSignalLike = (v: unknown): v is { get(): unknown } =>
  typeof v === 'object' && v !== null && 'get' in v && typeof v.get === 'function'

const isPoint = (v: unknown): v is readonly [number, number] =>
  Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number'

const resolveColors = (prop: AnimatableProp<string[]> | undefined): string[] => {
  if (prop === undefined) return DEFAULT_COLORS
  if (isSignalLike(prop)) return (prop as { get(): string[] }).get()

  return prop
}

function buildLinearGradientMaterial(
  // angleU and speedU are read via .value for JS-side direction/animation decisions
  angleU: ShaderNodeObject<Node> & { value: number },
  speedU: ShaderNodeObject<Node> & { value: number },
  cursorU: ShaderNodeObject<Node>,
  colors: string[],
  variant: 'linear' | 'radial' | undefined,
): MeshBasicNodeMaterial {
  const stops: ColorRampStop[] = colors.map((hex, i) => {
    const [r, g, b] = hexToVec3(hex)

    return {
      color: vec3(r, g, b),
      position: i / Math.max(colors.length - 1, 1),
    }
  })

  let tNode

  if (variant === 'radial') {
    tNode = length(uv().sub(cursorU))
  } else {
    // Read angle at build time — direction vector is baked into the TSL graph,
    // not reactive. To animate the angle, the effect dep array re-triggers the build.
    const angleRad = angleU.value * (Math.PI / 180)
    const dirX = Math.cos(angleRad)
    const dirY = Math.sin(angleRad)

    tNode = uv().sub(cursorU).dot(vec2(dirX, dirY)).add(0.5)
  }

  // Read speed at build time to decide whether to apply time-based animation
  const speedScalar = speedU.value
  const tAnimated =
    speedScalar === 0
      ? tNode
      : mod(tNode.add(time.mul(speedScalar)), 2)
          .sub(1)
          .abs()
          .oneMinus()

  const material = new MeshBasicNodeMaterial()

  material.colorNode = colorRamp(tAnimated, stops)

  return material
}

export function LinearGradient(props: LinearGradientProps) {
  const ctx = useShaderContext()
  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive === true ? cursorAuto : null)

  const isStatic = typeof props.speed === 'number' && props.speed === 0

  useStaticHint(isStatic)

  // Memoized so colors array identity is stable; colorsKey used in effect deps
  // to avoid rebuilding on every render when values haven't changed
  const colors = useMemo(
    () => resolveColors(props.colors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.colors],
  )
  const colorsKey = colors.join('|')

  const angleUniform = useAnimatableUniform<number>(props.angle ?? 0)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0)
  const focalUniform = useAnimatableUniform<readonly [number, number]>(
    props.focalPoint ?? [0.5, 0.5],
  )

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])

  useEffect(() => {
    if (cursor) {
      return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y))
    }
    const fp = props.focalPoint

    if (isPoint(fp)) {
      // y-flip: focalPoint is in UV space (0,0 = bottom-left), cursor y is DOM space (down = +y)
      cursorVec.set(fp[0], 1 - fp[1])
    } else {
      cursorVec.set(0.5, 0.5)
    }

    return undefined
  }, [cursor, cursorVec, props.focalPoint])

  useEffect(() => {
    if (!ctx) return

    const material = buildLinearGradientMaterial(
      angleUniform,
      speedUniform,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      cursorUniform as unknown as ShaderNodeObject<Node>,
      colors,
      props.variant,
    )
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)

    ctx.scene.add(mesh)

    return () => {
      ctx.scene.remove(mesh)

      try {
        material.dispose()
      } catch (err) {
        console.debug('[LinearGradient] material.dispose ignored:', err)
      }
      try {
        mesh.geometry.dispose()
      } catch (err) {
        console.debug('[LinearGradient] geometry.dispose ignored:', err)
      }
    }
  }, [
    ctx,
    props.variant,
    colorsKey,
    cursor,
    angleUniform,
    speedUniform,
    focalUniform,
    cursorUniform,
  ])

  return null
}
