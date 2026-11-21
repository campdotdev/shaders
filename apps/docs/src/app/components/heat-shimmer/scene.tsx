'use client';

import type { ReactNode } from 'react';

import { HeatShimmer, ShaderScene } from '@camp-dev/shaders';

import anthurium from '@/components/photo/anthurium.webp';
import { PhotoSource, usePhoto } from '@/components/photo/photo-source';

import { type HeatShimmerParams, INITIAL } from './params';

export default function HeatShimmerScene({
  params = INITIAL,
  children,
}: {
  params?: HeatShimmerParams;
  children?: ReactNode;
} = {}) {
  // The scene mounts once the photo has decoded. Until then DemoPoster keeps
  // showing the poster, which it drops at the scene's first frame.
  const photo = usePhoto(anthurium);

  if (!photo) return null;

  // The shimmer's lumps are sized in canvas heights, not CSS pixels, so the
  // photo covers the canvas at its own size and needs no frame.
  return (
    <ShaderScene>
      <PhotoSource photo={photo} />
      <HeatShimmer
        scale={params.scale}
        speed={params.speed}
        strength={params.strength}
        tuning={params.tuning}
      />
      {children}
    </ShaderScene>
  );
}
