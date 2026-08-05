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
        center={[params.centerX, params.centerY]}
        definition={params.definition}
        density={params.density}
        intensity={params.intensity}
        speed={params.speed}
        tuning={{
          bendAmount: params.bendAmount,
          bendFrequency: params.bendFrequency,
          dappleAmount: params.dappleAmount,
        }}
        waviness={params.waviness}
      />
      {children}
    </ShaderScene>
  );
}
