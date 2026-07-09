'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Aurora, type ColorStop } from '@matter/registry/aurora';

import { type AuroraParams, INITIAL } from './params';

export default function AuroraScene({
  params = INITIAL,
  children,
}: {
  params?: AuroraParams;
  children?: ReactNode;
} = {}) {
  const stops: ColorStop[] = params.stops.map((stop) => ({
    color: stop.color,
    position: stop.position,
  }));

  return (
    <ShaderScene>
      <Aurora
        colorSpace={params.colorSpace}
        density={params.density}
        direction={params.direction}
        drift={params.drift}
        falloff={params.falloff}
        hueInterpolation={params.hueInterpolation}
        intensity={params.intensity}
        speed={params.speed}
        stops={stops}
        turbulence={params.turbulence}
      />
      {children}
    </ShaderScene>
  );
}
