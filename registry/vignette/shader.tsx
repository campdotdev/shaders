'use client'

import {
  type AnimatableProp,
  useAnimatableUniform,
  useOverlayPass,
  useResize,
} from '@lovo/matter-react'
import { useEffect, useMemo } from 'react'
import {
  length,
  type ShaderNodeObject,
  smoothstep,
  mix as tslMix,
  uniform,
  uv,
  vec2,
  vec4,
} from 'three/tsl'
import { Vector2, Vector3 } from 'three/webgpu'
import type { Node } from 'three/webgpu'

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

  // center: a [x, y] tuple, not animatable. We wrap a real Vector2 in a
  // uniform so we can mutate it in place when the prop changes —
  // rebuilding the uniform would force a material recompile. Empty deps
  // are intentional; the useEffect below handles updates via .set().
  const centerVec = useMemo(
    () => new Vector2(center[0], center[1]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const centerU = useMemo(
    () => uniform(centerVec) as unknown as ShaderNodeObject<Node>,
    [centerVec],
  )

  useEffect(() => {
    centerVec.set(center[0], center[1])
  }, [center, centerVec])

  // color: parsed once from hex into a Vector3, then mutated in place
  // on every hex change. Same stable-instance pattern as center above.
  const colorVec = useMemo(
    () => {
      const [r, g, b] = parseHex(color)

      return new Vector3(r, g, b)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const colorU = useMemo(() => uniform(colorVec) as unknown as ShaderNodeObject<Node>, [colorVec])

  useEffect(() => {
    const [r, g, b] = parseHex(color)

    colorVec.set(r, g, b)
  }, [color, colorVec])

  // Resolution drives aspect correction so the vignette mask is a real
  // circle, not an ellipse stretched by the canvas aspect ratio.
  const resize = useResize()
  const resVec = useMemo(() => new Vector2(1920, 1080), [])
  const resNode = useMemo(() => uniform(resVec) as unknown as ShaderNodeObject<Node>, [resVec])

  useEffect(() => {
    const [w, h] = resize.get()

    if (w > 0 && h > 0) resVec.set(w, h)

    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2))
  }, [resize, resVec])

  useOverlayPass(
    (input) => {
      // Aspect-correct, centered uv. Distance in unit space so the
      // falloff ring is a real circle regardless of canvas aspect.
      const aspect = resNode.x.div(resNode.y)
      const centered = uv().sub(centerU)
      const corrected = vec2(centered.x.mul(aspect), centered.y)
      const dist = length(corrected)

      // Soft falloff ring. Inner edge = radius * (1 - softness):
      // softness 0 → inner = radius (hard ring), 1 → inner = 0 (very soft).
      const inner = radiusU.mul(softnessU.oneMinus())
      const mask = smoothstep(inner, radiusU, dist)
      const factor = mask.mul(intensityU)

      // Lerp the upstream pixel toward the edge color by factor.
      // factor=0 → input unchanged; factor=1 → fully edge color.
      return tslMix(input, vec4(colorU, 1), factor)
    },
    [intensityU, softnessU, radiusU, centerU, colorU, resNode],
  )

  return null
}
