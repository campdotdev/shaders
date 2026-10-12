'use client';

import type { ReactNode } from 'react';

import { LiquidGradient, ShaderScene } from '@camp-dev/shaders';

import { INITIAL, type Params } from './params';

export default function LiquidGradientScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <LiquidGradient
        angle={params.angle}
        colorSpace={params.colorSpace}
        hueInterpolation={params.hueInterpolation}
        repeat={params.repeat}
        scale={params.scale}
        seed={params.seed}
        softness={params.softness}
        speed={params.speed}
        stops={params.stops}
        swirl={params.swirl}
      />
      {children}
    </ShaderScene>
  );
}
