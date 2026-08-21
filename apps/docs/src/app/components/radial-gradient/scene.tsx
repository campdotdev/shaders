'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@camp-dev/shaders-react';
import { RadialGradient } from '@shaders/registry/radial-gradient';

import { INITIAL, type Params } from './params';

export default function RadialGradientScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  // colorRamp bakes stop colors and the color-space choice into the compiled
  // shader, so those changes need a remount rather than a uniform write.
  const remountKey = `${params.colorSpace}-${params.hueInterpolation}-${params.stops
    .map((stop) => `${stop.color}@${stop.position}`)
    .join(',')}`;

  return (
    <ShaderScene>
      <RadialGradient
        angle={params.angle}
        center={params.center}
        colorSpace={params.colorSpace}
        hueInterpolation={params.hueInterpolation}
        key={remountKey}
        radius={params.radius}
        repeat={params.repeat}
        speed={params.speed}
        stops={params.stops}
        stretch={params.stretch}
      />
      {children}
    </ShaderScene>
  );
}
