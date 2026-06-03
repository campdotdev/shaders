'use client'

import { colorRamp, type ColorRampStop, fbm, quantize, time, voronoi } from '@lovo/matter'
import {
  type AnimatableProp,
  type CursorSignal,
  useAnimatableUniform,
  useCursor,
  useShaderContext,
} from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import type { ShaderNodeObject } from 'three/tsl'
import { uniform, uv, vec2, vec3 } from 'three/tsl'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'
import type { Node } from 'three/webgpu'

export interface NoiseFieldProps {
  scale?: AnimatableProp<number>
  speed?: AnimatableProp<number>
  colors?: AnimatableProp<string[]>
  octaves?: number
  variant?: 'organic' | 'cellular' | 'grid'
  interactive?: boolean
  inputs?: { cursor?: CursorSignal }
}

const DEFAULT_COLORS = ['#131614', '#E7E9E7']
const GRID_STEPS = 6

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255

  return [r, g, b]
}

const isSignalLike = (v: unknown): v is { get(): unknown } =>
  typeof v === 'object' && v !== null && 'get' in v && typeof v.get === 'function'

const resolveColors = (prop: AnimatableProp<string[]> | undefined): string[] => {
  if (prop === undefined) return DEFAULT_COLORS
  if (isSignalLike(prop)) return prop.get()

  return prop
}

function buildNoiseFieldMaterial(
  scaleU: ShaderNodeObject<Node>,
  speedU: ShaderNodeObject<Node>,
  stops: ColorRampStop[],
  variant: 'organic' | 'cellular' | 'grid',
  octaves: number,
): MeshBasicNodeMaterial {
  const baseUv = uv().mul(scaleU)
  const tOff = time.mul(speedU)
  const animatedUv = baseUv.add(vec2(tOff, tOff))

  let t

  if (variant === 'cellular') {
    t = voronoi(animatedUv)
  } else if (variant === 'grid') {
    const raw = fbm(animatedUv, { octaves })
    const norm = raw.add(1).mul(0.5)

    t = quantize(norm, GRID_STEPS)
  } else {
    // 'organic': raw fbm normalized to [0, 1]
    const raw = fbm(animatedUv, { octaves })

    t = raw.add(1).mul(0.5)
  }

  const material = new MeshBasicNodeMaterial()

  material.colorNode = colorRamp(t, stops)

  return material
}

export function NoiseField(props: NoiseFieldProps) {
  const ctx = useShaderContext()

  // resolveColors handles signal-like (MotionValue) and plain array props
  const colors = useMemo(
    () => resolveColors(props.colors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.colors],
  )
  const colorsKey = colors.join('|')
  const octaves = props.octaves ?? 4
  const variant = props.variant ?? 'organic'

  const cursorFromInputs = props.inputs?.cursor
  const cursorAuto = useCursor()
  const cursor = cursorFromInputs ?? (props.interactive === true ? cursorAuto : null)

  const scaleUniform = useAnimatableUniform<number>(props.scale ?? 1)
  const speedUniform = useAnimatableUniform<number>(props.speed ?? 0.5)

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const _cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])

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

    const material = buildNoiseFieldMaterial(scaleUniform, speedUniform, stops, variant, octaves)
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)

    ctx.scene.add(mesh)

    return () => {
      ctx.scene.remove(mesh)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, colorsKey, octaves, variant, scaleUniform, speedUniform])

  return null
}
