'use client'

import { colorRamp, type ColorRampStop, noise, quantize, time } from '@lovo/matter'
import { type AnimatableProp, useAnimatableUniform, useShaderContext } from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import { clamp, mix, uniform, uv, vec3 } from 'three/tsl'
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu'

import { parseHex } from '../utils/color'

export interface SimplexNoiseShaderProps {
  scale: AnimatableProp<number>
  speed: AnimatableProp<number>
  focus: AnimatableProp<number>
  bias: AnimatableProp<number>
  softness: AnimatableProp<number>
  colors: string[]
  stops: number[] | undefined
  variant: number
}

export function SimplexNoiseShader({
  scale,
  speed,
  focus,
  bias,
  softness,
  colors,
  stops,
  variant,
}: SimplexNoiseShaderProps) {
  const ctx = useShaderContext()
  const scaleU = useAnimatableUniform<number>(scale)
  const speedU = useAnimatableUniform<number>(speed)
  const focusU = useAnimatableUniform<number>(focus)
  const biasU = useAnimatableUniform<number>(bias)
  const softnessU = useAnimatableUniform<number>(softness)

  const colorsKey = colors.join('|')
  const stopsKey = stops?.join('|') ?? ''

  const variantVec = useMemo(() => new Vector2(0, 0), [])
  const variantU = useMemo(() => uniform(variantVec), [variantVec])

  useEffect(() => {
    variantVec.set(variant * 12.9898, variant * 78.233)
    ctx?.scheduler.requestRender()
  }, [ctx, variantVec, variant])

  useEffect(
    () => {
      if (!ctx) return

      const sampleXY = uv().mul(scaleU).add(variantU)
      const samplePoint = vec3(sampleXY, time.mul(speedU))
      const raw = noise(samplePoint)
      const normalized = raw.add(1).mul(0.5)

      // Bias: shift the noise scalar earlier (<0.5) or later (>0.5) into the
      // color ramp. 0.5 is identity. In 2-color mode this reads as dark/light;
      // in multi-color mode it leans toward the first or last colors in the array.
      const biasShift = biasU.sub(0.5).mul(2)
      const biased = clamp(normalized.add(biasShift), 0, 1)

      // Focus: linear scale around 0.5. 1 is identity, >1 pushes values toward
      // the ramp extremes (first/last colors), <1 pulls them toward the middle.
      const t = clamp(biased.sub(0.5).mul(focusU).add(0.5), 0, 1)

      // Softness: blend between quantized contour bands (0) and smooth ramp (1).
      const stepCount = Math.max(colors.length, 1)
      const quantized = quantize(t, stepCount)
      const tBanded = mix(quantized, t, softnessU)

      // Build the colorRamp stops from colors[] + optional stops[] (auto-even otherwise).
      const evenAt = (i: number) => i / Math.max(colors.length - 1, 1)
      const rampStops: ColorRampStop[] = colors.map((hex, i) => {
        const [r, g, b] = parseHex(hex)
        const userPos = stops?.[i]
        const position = typeof userPos === 'number' ? Math.min(Math.max(userPos, 0), 1) : evenAt(i)

        return {
          color: vec3(r, g, b),
          position,
        }
      })

      const material = new MeshBasicNodeMaterial()

      material.colorNode = colorRamp(tBanded, rampStops)

      const mesh = new Mesh(new PlaneGeometry(2, 2), material)

      ctx.scene.add(mesh)

      return () => {
        ctx.scene.remove(mesh)
        try {
          material.dispose()
        } catch (err) {
          console.debug('[SimplexNoise] material.dispose ignored:', err)
        }
        try {
          mesh.geometry.dispose()
        } catch (err) {
          console.debug('[SimplexNoise] geometry.dispose ignored:', err)
        }
      }
    },
    // colorsKey and stopsKey are stable string proxies for the prop arrays;
    // the arrays themselves are intentionally omitted to avoid rebuilds on
    // identity-only changes. Animatable uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, scaleU, speedU, focusU, biasU, softnessU, variantU, colorsKey, stopsKey],
  )

  return null
}
