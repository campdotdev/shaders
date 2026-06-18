'use client';

import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { Palette } from '../utils/color';
import { MeshGradientShader } from './shader';

export type { Palette } from '../utils/color';

export interface MeshGradientProps {
  speed?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  amplitude?: AnimatableProp<number>;
  cycleSpeed?: AnimatableProp<number>;
  cycleEase?: AnimatableProp<number>;
  /** Two palettes to cross-fade between as the gradient cycles. */
  palettes?: [Palette, Palette];
  colorSpace?: ColorSpace;
  hueInterpolation?: HueInterpolation;
}

const DEFAULT_PALETTES: [Palette, Palette] = [
  [
    '#bcdc33', // palette.lime.base
    '#0ae24b', // palette.green.base
    '#00cda6', // palette.teal.base
    '#007bc6', // palette.sky.base
  ],
  [
    '#ecb100', // palette.amber.base
    '#ee6600', // palette.orange.base
    '#ff0029', // palette.red.base
    '#cc1a99', // palette.magenta.base
  ],
];

export function MeshGradient({
  speed = 2,
  frequency = 5,
  amplitude = 30,
  cycleSpeed = 0.5,
  cycleEase = 0.6,
  palettes = DEFAULT_PALETTES,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: MeshGradientProps) {
  return (
    <MeshGradientShader
      amplitude={amplitude}
      colorSpace={colorSpace}
      cycleEase={cycleEase}
      cycleSpeed={cycleSpeed}
      frequency={frequency}
      hueInterpolation={hueInterpolation}
      palettes={palettes}
      speed={speed}
    />
  );
}
