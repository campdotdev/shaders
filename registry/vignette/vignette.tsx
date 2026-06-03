'use client'

import type { AnimatableProp } from '@lovo/matter-react'

import { VignetteShader } from './shader'

export interface VignetteProps {
  intensity?: AnimatableProp<number>
  softness?: AnimatableProp<number>
  center?: [number, number]
  radius?: AnimatableProp<number>
  color?: string
}

export function Vignette({
  intensity = 0.4,
  softness = 0.5,
  center = [0.5, 0.5],
  radius = 0.7,
  color = '#0B0F0D',
}: VignetteProps) {
  return (
    <VignetteShader
      center={center}
      color={color}
      intensity={intensity}
      radius={radius}
      softness={softness}
    />
  )
}
