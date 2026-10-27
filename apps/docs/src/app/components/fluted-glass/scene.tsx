'use client';

import type { ReactNode } from 'react';

import { FlutedGlass, MeshGradient, ShaderScene } from '@camp-dev/shaders';

import { type FlutedGlassParams, INITIAL } from './params';

export default function FlutedGlassScene({
  params = INITIAL,
  children,
}: {
  params?: FlutedGlassParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <MeshGradient />
      <FlutedGlass
        angle={params.angle}
        crossSection={params.crossSection}
        fluteWidth={params.fluteWidth}
        refraction={params.refraction}
        tuning={params.tuning}
      />
      {children}
    </ShaderScene>
  );
}
