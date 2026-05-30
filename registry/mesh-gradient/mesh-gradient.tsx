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

// Light palette from the ShaderToy reference.
const DEFAULT_PALETTE_A: [string, string, string, string] = [
  '#ffba89', // amberYellow (source had R=299/255 → clamps to 1.0; #ffba89 is the visible result)
  '#3162ee', // deepBlue
  '#f69292', // pink
  '#59b5f3', // blue
]

// Dark palette from the ShaderToy reference.
const DEFAULT_PALETTE_B: [string, string, string, string] = [
  '#6931f5', // purpleHaze
  '#202a32', // swampyBlack
  '#e93334', // persimmonOrange
  '#e9a04b', // darkAmber
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
