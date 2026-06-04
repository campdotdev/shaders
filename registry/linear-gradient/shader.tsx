'use client'

import { colorRamp, type ColorRampStop, time } from '@lovo/matter'
import {
  type AnimatableProp,
  useAnimatableUniform,
  useCursor,
  useShaderContext,
  useStaticHint,
} from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import { cos, sub, uniform, uv, vec2, vec3 } from 'three/tsl'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'

import { parseHex } from '../utils/color'

export interface LinearGradientShaderProps {
  colors: string[]
  angle: AnimatableProp<number>
  focalPoint: AnimatableProp<readonly [number, number]>
  speed: AnimatableProp<number>
  interactive: boolean
}

const isPoint = (v: unknown): v is readonly [number, number] =>
  Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number'

export function LinearGradientShader({
  colors,
  angle,
  focalPoint,
  speed,
  interactive,
}: LinearGradientShaderProps) {
  const ctx = useShaderContext()
  const cursorAuto = useCursor()
  const cursor = interactive ? cursorAuto : null

  const isStatic = typeof speed === 'number' && speed === 0

  useStaticHint(isStatic)

  const colorsKey = colors.join('|')

  const angleUniform = useAnimatableUniform<number>(angle)
  const speedUniform = useAnimatableUniform<number>(speed)
  const focalUniform = useAnimatableUniform<readonly [number, number]>(focalPoint)

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), [])
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec])

  useEffect(() => {
    if (cursor) {
      return cursor.on('change', ([x, y]) => {
        cursorVec.set(x, 1 - y)
        ctx?.scheduler.requestRender()
      })
    }

    if (isPoint(focalPoint)) {
      cursorVec.set(focalPoint[0], 1 - focalPoint[1])
    } else {
      cursorVec.set(0.5, 0.5)
    }
    ctx?.scheduler.requestRender()

    return undefined
  }, [ctx, cursor, cursorVec, focalPoint])

  useEffect(() => {
    if (!ctx) return

    const stops: ColorRampStop[] = colors.map((hex, i) => {
      const [r, g, b] = parseHex(hex)

      return {
        color: vec3(r, g, b),
        position: i / Math.max(colors.length - 1, 1),
      }
    })

    const angleRad = angleUniform.value * (Math.PI / 180)
    const dirX = Math.cos(angleRad)
    const dirY = Math.sin(angleRad)

    const tNode = uv().sub(cursorUniform).dot(vec2(dirX, dirY)).add(0.5)

    // Cosine-smoothed ping-pong: (1 - cos(π·x)) / 2 has period 2 in x, peaks
    // at x=1, troughs at x=0/2 — same range and rhythm as a triangle wave but
    // C∞ smooth, so the apex doesn't show as a visible band.
    const speedScalar = speedUniform.value
    const tAnimated =
      speedScalar === 0
        ? tNode
        : sub(1, cos(tNode.add(time.mul(speedScalar)).mul(Math.PI))).mul(0.5)

    const material = new MeshBasicNodeMaterial()

    material.colorNode = colorRamp(tAnimated, stops)

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
  }, [ctx, colorsKey, cursor, angleUniform, speedUniform, focalUniform, cursorUniform, colors])

  return null
}
