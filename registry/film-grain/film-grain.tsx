'use client'

import type { AnimatableProp } from '@lovo/matter-react'

import { type FilmGrainMode, FilmGrainShader } from './shader'

export type { FilmGrainMode } from './shader'

export interface FilmGrainProps {
  intensity?: AnimatableProp<number>
  speed?: AnimatableProp<number>
  mode?: FilmGrainMode
}

export function FilmGrain({ intensity = 0.45, speed = 1, mode = 'additive' }: FilmGrainProps) {
  return <FilmGrainShader intensity={intensity} mode={mode} speed={speed} />
}
