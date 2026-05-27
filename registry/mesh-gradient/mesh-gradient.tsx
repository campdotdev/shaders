'use client'

import { MeshGradientShader } from './shader'
import type { AnimatableProp } from '@lovo/matter-react'

export interface MeshGradientProps {
  /** Global animation rate. Default 2. */
  speed?: AnimatableProp<number>
  /** Sine warp frequency. Higher = more wobbles per gradient. Default 5. */
  frequency?: AnimatableProp<number>
  /** Sine warp amplitude divisor. Higher = subtler wobble. Default 30. */
  amplitude?: AnimatableProp<number>
}

export function MeshGradient({ speed = 2, frequency = 5, amplitude = 30 }: MeshGradientProps) {
  return <MeshGradientShader speed={speed} frequency={frequency} amplitude={amplitude} />
}
