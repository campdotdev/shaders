'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { MeshGradient } from '@matter/registry/mesh-gradient';

import { INITIAL, type Params } from './params';

export default function MeshGradientScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <MeshGradient
        amplitude={params.amplitude}
        colorSpace={params.colorSpace}
        cycleEase={params.cycleEase}
        cycleSpeed={params.cycleSpeed}
        frequency={params.frequency}
        hueInterpolation={params.hueInterpolation}
        palettes={[
          [params.a0, params.a1, params.a2, params.a3],
          [params.b0, params.b1, params.b2, params.b3],
        ]}
        speed={params.speed}
      />
      {children}
    </ShaderScene>
  );
}
