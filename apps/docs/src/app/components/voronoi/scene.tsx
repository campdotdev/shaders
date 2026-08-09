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
      <Voronoi scale={params.scale} seed={params.seed} stops={stops} />
      {children}
    </ShaderScene>
  );
}
