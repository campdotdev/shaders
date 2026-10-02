'use client';

import type { ReactNode } from 'react';

import { Aurora, type ColorStop, ShaderScene } from '@camp-dev/shaders';

import { type AuroraParams, INITIAL } from './params';

export default function AuroraScene({
  params = INITIAL,
  children,
  maxDPR,
}: {
  params?: AuroraParams;
  children?: ReactNode;
  /** Cap on the canvas's pixel ratio, passed to ShaderScene. Leave unset for ShaderScene's default of 2. */
  maxDPR?: number;
} = {}) {
  const stops: ColorStop[] = params.stops.map((stop) => ({
    color: stop.color,
    position: stop.position,
  }));

  return (
    <ShaderScene maxDPR={maxDPR}>
      <Aurora
        colorSpace={params.colorSpace}
        coverage={params.coverage}
        hueInterpolation={params.hueInterpolation}
        intensity={params.intensity}
        speed={params.speed}
        stops={stops}
        waviness={params.waviness}
      />
      {children}
    </ShaderScene>
  );
}
