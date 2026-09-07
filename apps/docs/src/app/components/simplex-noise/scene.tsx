'use client';

import type { ReactNode } from 'react';

import { type ColorStop, ShaderScene, SimplexNoise } from '@camp-dev/shaders';

import { INITIAL, type Params } from './params';

export default function SimplexNoiseScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  const stops: ColorStop[] = params.stops;

  return (
    <ShaderScene>
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
