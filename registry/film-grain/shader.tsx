'use client'

import { filmGrain, time } from '@lovo/matter'
import {
  type AnimatableProp,
  useAnimatableUniform,
  useOverlayPass,
  useStaticHint,
} from '@lovo/matter-react'
import { floor, vec4 } from 'three/tsl'

export type FilmGrainMode = 'additive' | 'subtractive'

export interface FilmGrainShaderProps {
  intensity: AnimatableProp<number>
  speed: AnimatableProp<number>
  mode: FilmGrainMode
}

export function FilmGrainShader({ intensity, speed, mode }: FilmGrainShaderProps) {
  const intensityU = useAnimatableUniform<number>(intensity)
  const speedU = useAnimatableUniform<number>(speed)

  const isStatic = typeof speed === 'number' && speed === 0

  useStaticHint(isStatic)

  useOverlayPass(
    (input) => {
      const grainTime = floor(time.mul(speedU).mul(60))
      const grain = filmGrain(intensityU, grainTime)

      if (mode === 'additive') {
        return input.add(vec4(grain, grain, grain, 0))
      }

      const positive = grain.abs()

      return input.sub(vec4(positive, positive, positive, 0))
    },
    [intensityU, speedU, mode],
  )

  return null
}
