'use client';

import type { ReactNode } from 'react';

import { type ColorStop, ShaderScene, SimplexNoise } from '@camp-dev/shaders';

import { INITIAL, type Params } from './params';

export default function SimplexNoiseScene({
  params = INITIAL,
  children,
  paused,
}: {
  params?: Params;
  children?: ReactNode;
  /**
   * Freezes the scene on its current frame, passed to ShaderScene. A homepage
   * favorite pauses it once the pointer and keyboard focus have both left
   * its card.
   */
  paused?: boolean;
} = {}) {
  const stops: ColorStop[] = params.stops;

  return (
    <ShaderScene paused={paused}>
      <SimplexNoise
        balance={params.balance}
        colorSpace={params.colorSpace}
        contrast={params.contrast}
        hueInterpolation={params.hueInterpolation}
        scale={params.scale}
        seed={params.seed}
        softness={params.softness}
        speed={params.speed}
        stops={stops}
      />
      {children}
    </ShaderScene>
  );
}
