'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { type GrainBlend, GrainShader } from './shader';

export type { GrainBlend } from './shader';

export interface GrainProps {
  intensity?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  grainBlend?: GrainBlend;
}

export function Grain({ intensity = 0.15, speed = 0.3, grainBlend = 'additive' }: GrainProps) {
  return <GrainShader grainBlend={grainBlend} intensity={intensity} speed={speed} />;
}
