'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Grain } from '@matter/registry/grain';
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
  const vignetteEl = (
    <Vignette
      center={[params.centerX, params.centerY]}
      color={params.color}
      intensity={params.intensity}
      radius={params.radius}
      softness={params.softness}
    />
  );
  const grainEl = <Grain intensity={params.grainIntensity} />;

  return (
    <ShaderScene>
      <LinearGradient />
      {params.grainOrderFirst ? (
        <>
          {grainEl}
          {vignetteEl}
        </>
      ) : (
        <>
          {vignetteEl}
          {grainEl}
        </>
      )}
      {children}
    </ShaderScene>
  );
}
