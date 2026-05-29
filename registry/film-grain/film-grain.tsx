'use client'

import { FilmGrainShader, type FilmGrainMode } from './shader'
import type { AnimatableProp } from '@lovo/matter-react'

export type { FilmGrainMode } from './shader'

export interface FilmGrainProps {
  /** Grain strength. 0 = clean, 1 = heavy. Default 0.45. */
  intensity?: AnimatableProp<number>
  /** Twinkle rate. 0 = static, 1 = ~60Hz, 0.4 = ~24Hz film cadence. Default 1. */
  speed?: AnimatableProp<number>
  /**
   * 'additive' (default): adds signed grain so half the pixels brighten and
   * half darken, preserving average exposure — pure texture, no exposure shift.
   * 'subtractive': only darkens (silver-emulsion film-stock look).
   */
  mode?: FilmGrainMode
}

export function FilmGrain({ intensity = 0.45, speed = 1, mode = 'additive' }: FilmGrainProps) {
  return <FilmGrainShader intensity={intensity} speed={speed} mode={mode} />
}
