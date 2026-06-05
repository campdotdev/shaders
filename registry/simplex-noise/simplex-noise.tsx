'use client'

import type { AnimatableProp } from '@lovo/matter-react'

import { SimplexNoiseShader } from './shader'

export interface SimplexNoiseProps {
  colors?: string[]
  stops?: number[]
  scale?: AnimatableProp<number>
  speed?: AnimatableProp<number>
  focus?: AnimatableProp<number>
  bias?: AnimatableProp<number>
  softness?: AnimatableProp<number>
  variant?: number
}

const DEFAULT_COLORS = [
  '#1837e6', // palette.blue.base
  '#661acc', // palette.violet.base
  '#9e00ba', // palette.purple.base
  '#cc1a99', // palette.magenta.base
  '#00cda6', // palette.teal.base
]

export function SimplexNoise({
  colors = DEFAULT_COLORS,
  stops,
  scale = 10,
  speed = 0.2,
  focus = 2.5,
  bias = 0.5,
  softness = 0,
  variant = 0,
}: SimplexNoiseProps) {
  return (
    <SimplexNoiseShader
      bias={bias}
      colors={colors}
      focus={focus}
      scale={scale}
      softness={softness}
      speed={speed}
      stops={stops}
      variant={variant}
    />
  )
}
