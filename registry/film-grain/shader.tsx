'use client'

import type { AnimatableProp } from '@lovo/matter-react'

export type FilmGrainMode = 'centered' | 'subtractive'

export interface FilmGrainShaderProps {
  intensity: AnimatableProp<number>
  speed: AnimatableProp<number>
  mode: FilmGrainMode
}

// Implementation lands in Task 3.2 (user-written).
export function FilmGrainShader(_props: FilmGrainShaderProps) {
  return null
}
