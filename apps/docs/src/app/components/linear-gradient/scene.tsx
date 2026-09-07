'use client';

import type { ReactNode } from 'react';

import { LinearGradient, ShaderScene } from '@camp-dev/shaders';

import { INITIAL, type Params } from './params';

export default function LinearGradientScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  const remountKey = `${params.colorSpace}-${params.hueInterpolation}-${params.stops
    .map((stop) => `${stop.color}@${stop.position}`)
    .join(',')}`;

  return (
    <ShaderScene>
      <LinearGradient
        angle={params.angle}
        center={params.center}
        colorSpace={params.colorSpace}
        hueInterpolation={params.hueInterpolation}
        key={remountKey}
        repeat={params.repeat}
        speed={params.speed}
        stops={params.stops}
      />
      {children}
    </ShaderScene>
  );
}
