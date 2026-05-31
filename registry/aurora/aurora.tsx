'use client'

import type { AnimatableProp } from '@lovo/matter-react'

import { type AuroraDirection, type AuroraLayer, AuroraShader } from './shader'

export type { AuroraDirection, AuroraLayer } from './shader'

export interface AuroraProps {
  /** Global brightness multiplier. 0 = invisible, 1 = default, 3 = blown out. */
  intensity?: AnimatableProp<number>
  /** Global animation rate. 1 = default, 0 = frozen, 2 = double speed. */
  speed?: AnimatableProp<number>
  /** Horizontal feature density. Higher = more ribbons packed across the frame. */
  densityX?: AnimatableProp<number>
  /** Vertical feature density. Higher = more vertical detail in each ribbon. */
  densityY?: AnimatableProp<number>
  /** How quickly the curtains fade out toward the top. Higher = shorter reach. */
  falloff?: AnimatableProp<number>
  /** Horizontal wind speed. */
  driftX?: AnimatableProp<number>
  /** Vertical wind speed. */
  driftY?: AnimatableProp<number>
  /**
   * How much each ribbon curls in place. 0 = straight flowing noise,
   * 1 = default curl, 2-3 = turbulent. Independent of `densityX`/`densityY`
   * which control feature density.
   */
  turbulence?: AnimatableProp<number>
  /** Which edge the aurora rises from. Default `'bottom'`. */
  direction?: AuroraDirection
  /** Horizon color concentrated near the bottom of the frame. */
  horizonColor?: string
  /** Mid-sky color covering the lower 60% of the frame. */
  skyColor?: string
  /** Four curtain layers stacked back-to-front. */
  layers?: [AuroraLayer, AuroraLayer, AuroraLayer, AuroraLayer]
}

/**
 * Default curtain layers — colors and rates lifted from the Shadertoy
 * reference (green/blue/violet/magenta cycling at distinct drift speeds).
 * Each layer runs identical noise math; what makes them feel different is
 * just color, rate, and the color-seeded warp.
 */
export const DEFAULT_LAYERS: [AuroraLayer, AuroraLayer, AuroraLayer, AuroraLayer] = [
  { hex: '#0ae24b', speed: 0.07, intensity: 0.6, variation: 0 }, // palette.green.base
  { hex: '#1837e6', speed: 0.1, intensity: 0, variation: 5 }, // palette.blue.base
  { hex: '#661acc', speed: 0.15, intensity: 0.3, variation: 11 }, // palette.violet.base
  { hex: '#cc1a99', speed: 0.07, intensity: 0, variation: 17 }, // palette.magenta.base
]

export function Aurora({
  intensity = 1,
  speed = 0.6,
  densityX = 1.35,
  densityY = 5.35,
  falloff = 1.1,
  driftX = 0.2,
  driftY = -3.15,
  turbulence = 1.3,
  direction = 'top',
  horizonColor = '#040009',
  skyColor = '#146389',
  layers = DEFAULT_LAYERS,
}: AuroraProps) {
  return (
    <AuroraShader
      densityX={densityX}
      densityY={densityY}
      direction={direction}
      driftX={driftX}
      driftY={driftY}
      falloff={falloff}
      horizonColor={horizonColor}
      intensity={intensity}
      layers={layers}
      skyColor={skyColor}
      speed={speed}
      turbulence={turbulence}
    />
  )
}
