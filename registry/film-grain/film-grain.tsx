'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { type FilmGrainBlend, FilmGrainShader } from './shader';

export type { FilmGrainBlend } from './shader';

export interface FilmGrainProps {
  intensity?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  grainBlend?: FilmGrainBlend;
}

export function FilmGrain({
  intensity = 0.45,
  speed = 1,
  grainBlend = 'additive',
}: FilmGrainProps) {
  return <FilmGrainShader intensity={intensity} grainBlend={grainBlend} speed={speed} />;
}
