'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { GodRays } from '@matter/registry/god-rays';

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
        tuning={{
          patchScale: params.patchScale,
          flowA: params.flowA,
          flowB: params.flowB,
          fieldARadial: params.fieldARadial,
          fieldBRadial: params.fieldBRadial,
          bendAmount: params.bendAmount,
          bendFrequency: params.bendFrequency,
          glowRayBoost: params.glowRayBoost,
          falloffStart: params.falloffStart,
        }}
        waviness={params.waviness}
      />
      {children}
    </ShaderScene>
  );
}
