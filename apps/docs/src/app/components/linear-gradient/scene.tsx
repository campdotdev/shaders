'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { LinearGradient } from '@matter/registry/linear-gradient';

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
        speed={params.speed}
        stops={params.stops}
      />
      {children}
    </ShaderScene>
  );
}
