'use client';

import type { ReactNode } from 'react';

import { type ColorStop, ShaderScene, Voronoi } from '@camp-dev/shaders';

import { INITIAL, type Params } from './params';

export default function VoronoiScene({
  params = INITIAL,
  children,
  paused,
}: {
  params?: Params;
  children?: ReactNode;
  /**
   * Freezes the scene on its current frame, passed to ShaderScene. A homepage
   * favorite pauses it once the pointer and keyboard focus have both left
   * its card.
   */
  paused?: boolean;
} = {}) {
  const stops: ColorStop[] = params.stops;

  return (
    <ShaderScene paused={paused}>
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
