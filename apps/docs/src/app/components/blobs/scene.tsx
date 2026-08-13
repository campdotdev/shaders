'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Blobs } from '@matter/registry/blobs';
import type { ColorStop } from '@matter/registry/blobs';
import { LinearGradient } from '@matter/registry/linear-gradient';

import { INITIAL, type Params } from './params';

// The demo stacks Blobs over a quiet static gradient: the space between
// blobs is transparent, and showing the layer beneath is the point.
const BACKGROUND_STOPS = [{ color: 'oklch(0.18 0.02 265)' }, { color: 'oklch(0.26 0.04 300)' }];

export default function BlobsScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  const stops: ColorStop[] = params.stops;

  return (
    <ShaderScene>
      <LinearGradient angle={90} speed={0} stops={BACKGROUND_STOPS} />
      <Blobs
        center={params.center}
        colorSpace={params.colorSpace}
        count={params.count}
        hueInterpolation={params.hueInterpolation}
        seed={params.seed}
        shading={params.shading}
        size={params.size}
        sizeVariation={params.sizeVariation}
        softness={params.softness}
        speed={params.speed}
        spread={params.spread}
        stops={stops}
      />
      {children}
    </ShaderScene>
  );
}
