'use client'

import { VignetteShader } from './shader'
import type { AnimatableProp } from '@lovo/matter-react'

export interface VignetteProps {
  /** How dark the edges go. 0 = no vignette, 1 = full edge color at corners. Default 0.4. */
  intensity?: AnimatableProp<number>
  /** Falloff gradualness. 0 = hard ring, 1 = very soft. Default 0.5. */
  softness?: AnimatableProp<number>
  /** Normalized UV of the bright center. Default [0.5, 0.5]. */
  center?: [number, number]
  /** Distance from center where darkening begins. Default 0.7. */
  radius?: AnimatableProp<number>
  /** What color to fade edges toward. Default brand black (palette.black). */
  color?: string
}

export function Vignette({
  intensity = 0.4,
  softness = 0.5,
  center = [0.5, 0.5],
  radius = 0.7,
  color = '#0B0F0D', // palette.black
}: VignetteProps) {
  return (
    <VignetteShader
      intensity={intensity}
      softness={softness}
      center={center}
      radius={radius}
      color={color}
    />
  )
}
