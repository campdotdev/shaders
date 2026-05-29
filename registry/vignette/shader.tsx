'use client'

import type { AnimatableProp } from '@lovo/matter-react'

export interface VignetteShaderProps {
  intensity: AnimatableProp<number>
  softness: AnimatableProp<number>
  center: [number, number]
  radius: AnimatableProp<number>
  color: string
}

// Implementation lands in Task 4.2 (user-written).
export function VignetteShader(_props: VignetteShaderProps) {
  return null
}
