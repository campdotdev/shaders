'use client'

import { filmGrain, time } from '@lovo/matter'
import { type AnimatableProp, useAnimatableUniform, useOverlayPass } from '@lovo/matter-react'
import { floor, uv, vec4 } from 'three/tsl'

export type FilmGrainMode = 'additive' | 'subtractive'

export interface FilmGrainShaderProps {
  intensity: AnimatableProp<number>
  speed: AnimatableProp<number>
  mode: FilmGrainMode
}

export function FilmGrainShader({ intensity, speed, mode }: FilmGrainShaderProps) {
  const intensityU = useAnimatableUniform<number>(intensity)
  const speedU = useAnimatableUniform<number>(speed)

  useOverlayPass(
    (input) => {
      // Quantize time so the grain re-randomizes at a discrete shutter rate
      // instead of every frame. speed=1 → 60Hz; speed=0.4 → ~24Hz film cadence.
      const grainTime = floor(time.mul(speedU).mul(60))
      const grain = filmGrain(uv(), intensityU, grainTime)

      if (mode === 'additive') {
        // filmGrain returns a signed value with mean ≈ 0, so adding it
        // brightens half the pixels and darkens the other half — average
        // exposure is preserved.
        return input.add(vec4(grain, grain, grain, 0))
      }

      // Subtractive (silver-emulsion look): only darkens. Take abs() so the
      // primitive's negative half also contributes to darkening instead of
      // brightening half the pixels.
      const positive = grain.abs()

      return input.sub(vec4(positive, positive, positive, 0))
    },
    [intensityU, speedU, mode],
  )

  return null
}
