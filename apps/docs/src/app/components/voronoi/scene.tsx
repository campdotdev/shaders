'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@mattermix/shaders-react';
import { Voronoi } from '@shaders/registry/voronoi';
import type { ColorStop } from '@shaders/registry/voronoi';

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
      />
      {children}
    </ShaderScene>
  );
}
