'use client';

import type { ReactNode } from 'react';

import { FlutedGlass, ShaderScene } from '@camp-dev/shaders';

import anthurium from './anthurium.webp';
import { type FlutedGlassParams, INITIAL } from './params';
import { PhotoSource, usePhoto } from './photo-source';

export default function FlutedGlassScene({
  params = INITIAL,
  children,
}: {
  params?: FlutedGlassParams;
  children?: ReactNode;
} = {}) {
  // The scene mounts once the photo has decoded. Until then DemoPoster keeps
  // showing the poster, which it drops at the scene's first frame.
  const photo = usePhoto(anthurium);

  if (!photo) return null;

  return (
    <ShaderScene>
      <PhotoSource photo={photo} />
      <FlutedGlass
        angle={params.angle}
        crossSection={params.crossSection}
        dispersion={params.dispersion}
        fluteWidth={params.fluteWidth}
        highlight={params.highlight}
        highlightColor={params.highlightColor}
        lightAngle={params.lightAngle}
        refraction={params.refraction}
        shadow={params.shadow}
      />
      {children}
    </ShaderScene>
  );
}
