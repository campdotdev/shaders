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

// Cool-spring palette — analogous lime → green → teal → sky spectrum,
// 115° hue span, lightness decreasing naturally (0.84 → 0.55).
const DEFAULT_PALETTE_A: [string, string, string, string] = [
  '#bcdc33', // palette.lime.base
  '#0ae24b', // palette.green.base
  '#00cda6', // palette.teal.base
  '#007bc6', // palette.sky.base
]

// Warm-sunset palette — analogous amber → orange → red → magenta spectrum,
// ~100° hue span through the warm side, lightness decreasing (0.79 → 0.57).
const DEFAULT_PALETTE_B: [string, string, string, string] = [
  '#ecb100', // palette.amber.base
  '#ee6600', // palette.orange.base
  '#ff0029', // palette.red.base
  '#cc1a99', // palette.magenta.base
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
