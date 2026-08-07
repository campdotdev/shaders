'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { ConicGradient } from '@matter/registry/conic-gradient';

import { INITIAL, type Params } from './params';

export default function ConicGradientScene({
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
      <ConicGradient
        angle={params.angle}
        center={params.center}
        colorSpace={params.colorSpace}
        hueInterpolation={params.hueInterpolation}
        key={remountKey}
        repeat={params.repeat}
        stops={params.stops}
      />
      {children}
    </ShaderScene>
  );
}
