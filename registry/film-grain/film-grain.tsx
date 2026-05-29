'use client'

import { FilmGrainShader, type FilmGrainMode } from './shader'
import type { AnimatableProp } from '@lovo/matter-react'

export type { FilmGrainMode } from './shader'

export interface FilmGrainProps {
  /** Grain strength. 0 = clean, 1 = heavy. Default 0.08. */
  intensity?: AnimatableProp<number>
  /** Twinkle rate. 0 = static, 1 = ~60Hz, 0.4 = ~24Hz film cadence. Default 1. */
  speed?: AnimatableProp<number>
  /**
   * 'centered' (default): brightens half, darkens half, mean-preserving.
   * 'subtractive': only darkens (silver-emulsion film-stock look).
   */
  mode?: FilmGrainMode
}

export function FilmGrain({
  intensity = 0.08,
  speed = 1,
  mode = 'centered',
}: FilmGrainProps) {
  return <FilmGrainShader intensity={intensity} speed={speed} mode={mode} />
}
