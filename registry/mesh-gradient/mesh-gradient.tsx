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
  /** Palette A ↔ B crossfade rate. 0 = freeze, default 0.5. */
  cycleSpeed?: AnimatableProp<number>
  /** Crossfade shape. <1 = linger at extremes, 1 = pure sine, >1 = linger at midpoint. Default 0.6. */
  cycleEase?: AnimatableProp<number>
  /** Light palette: 4 hex strings. */
  paletteA?: [string, string, string, string]
  /** Dark palette: 4 hex strings. */
  paletteB?: [string, string, string, string]
}

// Vibrant rainbow palette — amber + blue + magenta + lime around the wheel.
const DEFAULT_PALETTE_A: [string, string, string, string] = [
  '#ecb100', // palette.amber.base
  '#1837e6', // palette.blue.base
  '#cc1a99', // palette.magenta.base
  '#bcdc33', // palette.lime.base
]

// Moody warm palette — deep purple, near-black, vivid magenta, dark amber.
const DEFAULT_PALETTE_B: [string, string, string, string] = [
  '#43008e', // palette.violet.dark
  '#131614', // palette.gray[1]
  '#cc1a99', // palette.magenta.base
  '#b38400', // palette.amber.dark
]

export function MeshGradient({
  speed = 2,
  frequency = 5,
  amplitude = 30,
  cycleSpeed = 0.5,
  cycleEase = 0.6,
  paletteA = DEFAULT_PALETTE_A,
  paletteB = DEFAULT_PALETTE_B,
}: MeshGradientProps) {
  return (
    <MeshGradientShader
      speed={speed}
      frequency={frequency}
      amplitude={amplitude}
      cycleSpeed={cycleSpeed}
      cycleEase={cycleEase}
      paletteA={paletteA}
      paletteB={paletteB}
    />
  )
}
