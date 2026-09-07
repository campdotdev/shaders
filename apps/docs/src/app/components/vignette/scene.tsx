'use client';

import type { ReactNode } from 'react';

import { LinearGradient, ShaderScene, Vignette } from '@camp-dev/shaders';

import { INITIAL, type VignetteParams } from './params';

export default function VignetteScene({
  params = INITIAL,
  children,
}: {
  params?: VignetteParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <LinearGradient />
      <Vignette
        center={params.center}
        color={params.color}
        colorSpace={params.colorSpace}
        feather={params.feather}
        hueInterpolation={params.hueInterpolation}
        intensity={params.intensity}
        radius={params.radius}
      />
      {children}
    </ShaderScene>
  );
}
