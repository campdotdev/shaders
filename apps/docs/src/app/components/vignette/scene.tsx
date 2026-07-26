'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { LinearGradient } from '@matter/registry/linear-gradient';
import { Vignette } from '@matter/registry/vignette';

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
