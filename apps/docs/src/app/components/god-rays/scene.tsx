'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@camp-dev/shaders-react';
import { GodRays } from '@shaders/registry/god-rays';

import { type GodRaysParams, INITIAL } from './params';

export default function GodRaysScene({
  params = INITIAL,
  children,
}: {
  params?: GodRaysParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <GodRays
        angle={params.angle}
        center={[params.centerX, params.centerY]}
        colors={params.colors}
        density={params.density}
        diffusion={params.diffusion}
        glowIntensity={params.glowIntensity}
        glowRadius={params.glowRadius}
        intensity={params.intensity}
        patchiness={params.patchiness}
        radius={params.radius}
        speed={params.speed}
        spread={params.spread}
      />
      {children}
    </ShaderScene>
  );
}
