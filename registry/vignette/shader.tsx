'use client'

import {
  type AnimatableProp,
  useAnimatableUniform,
  useOverlayPass,
  useResize,
} from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import { length, smoothstep, mix as tslMix, uniform, uv, vec2, vec4 } from 'three/tsl'
import { Vector2, Vector3 } from 'three/webgpu'

import { parseHex } from '../utils/color'

export interface VignetteShaderProps {
  intensity: AnimatableProp<number>
  softness: AnimatableProp<number>
  center: [number, number]
  radius: AnimatableProp<number>
  color: string
}

export function VignetteShader({
  intensity,
  softness,
  center,
  radius,
  color,
}: VignetteShaderProps) {
  const intensityU = useAnimatableUniform(intensity)
  const softnessU = useAnimatableUniform(softness)
  const radiusU = useAnimatableUniform(radius)

  const centerVec = useMemo(
    () => new Vector2(center[0], center[1]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const centerU = useMemo(() => uniform(centerVec), [centerVec])

  useEffect(() => {
    centerVec.set(center[0], center[1])
  }, [center, centerVec])

  const colorVec = useMemo(
    () => {
      const [r, g, b] = parseHex(color)

      return new Vector3(r, g, b)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const colorU = useMemo(() => uniform(colorVec), [colorVec])

  useEffect(() => {
    const [r, g, b] = parseHex(color)

    colorVec.set(r, g, b)
  }, [color, colorVec])

  const resize = useResize()
  const resVec = useMemo(() => new Vector2(1920, 1080), [])
  const resNode = useMemo(() => uniform(resVec), [resVec])

  useEffect(() => {
    const [w, h] = resize.get()

    if (w > 0 && h > 0) resVec.set(w, h)

    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2))
  }, [resize, resVec])

  useOverlayPass(
    (input) => {
      const aspect = resNode.x.div(resNode.y)
      const centered = uv().sub(centerU)
      const corrected = vec2(centered.x.mul(aspect), centered.y)
      const dist = length(corrected)

      const inner = radiusU.mul(softnessU.oneMinus())
      const mask = smoothstep(inner, radiusU, dist)
      const factor = mask.mul(intensityU)

      return tslMix(input, vec4(colorU, 1), factor)
    },
    [intensityU, softnessU, radiusU, centerU, colorU, resNode],
  )

  return null
}
