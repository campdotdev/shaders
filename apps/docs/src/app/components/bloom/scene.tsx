'use client';

import type { ReactNode } from 'react';

import { Bloom, ShaderScene } from '@camp-dev/shaders';

import neonMotel from '@/components/photo/neon-motel.webp';
import { PhotoSource, usePhoto } from '@/components/photo/photo-source';

import { type BloomParams, INITIAL } from './params';

export default function BloomScene({
  params = INITIAL,
  children,
}: {
  params?: BloomParams;
  children?: ReactNode;
} = {}) {
  // The scene mounts once the photo has decoded. Until then DemoPoster keeps
  // showing the poster, which it drops at the scene's first frame.
  const photo = usePhoto(neonMotel);

  if (!photo) return null;

  // The glow is sized in canvas heights, not CSS pixels, so the photo covers
  // the canvas at its own size and needs no frame.
  return (
    <ShaderScene>
      <PhotoSource photo={photo} />
      <Bloom radius={params.radius} strength={params.strength} threshold={params.threshold} />
      {children}
    </ShaderScene>
  );
}
