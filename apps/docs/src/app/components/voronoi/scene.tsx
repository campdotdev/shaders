'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Voronoi } from '@matter/registry/voronoi';
import type { ColorStop } from '@matter/registry/voronoi';

import { INITIAL, type Params } from './params';

export default function VoronoiScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  const stops: ColorStop[] = params.stops;

  return (
    <ShaderScene>
      <Voronoi
        borderColor={params.borderColor}
        borderSoftness={params.borderSoftness}
        borderWidth={params.borderWidth}
        colorSpace={params.colorSpace}
        drift={params.drift}
        glow={params.glow}
        hueInterpolation={params.hueInterpolation}
        irregularity={params.irregularity}
        scale={params.scale}
        seed={params.seed}
        shading={params.shading}
        speed={params.speed}
        steps={params.steps}
        stops={stops}
        tuning={params.tuning}
      />
      {children}
    </ShaderScene>
  );
}
