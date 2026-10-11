'use client';

import type { ReactNode } from 'react';

import { ShaderScene, SwirlGradient } from '@camp-dev/shaders';

import { INITIAL, type Params } from './params';

export default function SwirlGradientScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <SwirlGradient
        angle={params.angle}
        colorSpace={params.colorSpace}
        hueInterpolation={params.hueInterpolation}
        repeat={params.repeat}
        scale={params.scale}
        seed={params.seed}
        stops={params.stops}
        swirl={params.swirl}
        tuning={params.tuning}
      />
      {children}
    </ShaderScene>
  );
}
