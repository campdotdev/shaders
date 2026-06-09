'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { MeshGradientShader } from './shader';

export interface MeshGradientProps {
  speed?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  amplitude?: AnimatableProp<number>;
  cycleSpeed?: AnimatableProp<number>;
  cycleEase?: AnimatableProp<number>;
  paletteA?: [string, string, string, string];
  paletteB?: [string, string, string, string];
}

const DEFAULT_PALETTE_A: [string, string, string, string] = [
  '#bcdc33', // palette.lime.base
  '#0ae24b', // palette.green.base
  '#00cda6', // palette.teal.base
  '#007bc6', // palette.sky.base
];

const DEFAULT_PALETTE_B: [string, string, string, string] = [
  '#ecb100', // palette.amber.base
  '#ee6600', // palette.orange.base
  '#ff0029', // palette.red.base
  '#cc1a99', // palette.magenta.base
];

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
      amplitude={amplitude}
      cycleEase={cycleEase}
      cycleSpeed={cycleSpeed}
      frequency={frequency}
      paletteA={paletteA}
      paletteB={paletteB}
      speed={speed}
    />
  );
}
