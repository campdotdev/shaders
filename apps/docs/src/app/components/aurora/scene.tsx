'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import type { AuroraLayer } from '@matter/registry/aurora';
import { Aurora } from '@matter/registry/aurora';

import { type AuroraParams, INITIAL } from './params';

export default function AuroraScene({
  params = INITIAL,
  children,
}: {
  params?: AuroraParams;
  children?: ReactNode;
} = {}) {
  const layers: AuroraLayer[] = params.layers.map((layer) => ({
    color: layer.color,
    speed: layer.speed,
    intensity: layer.intensity,
    seed: layer.seed,
    falloff: layer.falloff,
  }));

  return (
    <ShaderScene>
      <Aurora
        densityX={params.densityX}
        densityY={params.densityY}
        direction={params.direction}
        driftX={params.driftX}
        driftY={params.driftY}
        falloff={params.falloff}
        intensity={params.intensity}
        layers={layers}
        speed={params.speed}
        turbulence={params.turbulence}
      />
      {children}
    </ShaderScene>
  );
}
