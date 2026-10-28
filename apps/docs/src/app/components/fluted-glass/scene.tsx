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
