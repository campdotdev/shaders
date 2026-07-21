'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Waves } from '@matter/registry/waves';
import type { WaveLayer } from '@matter/registry/waves';

import { INITIAL, type Params } from './params';

export default function WavesScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  const layers: WaveLayer[] = params.layers.map((layer) => ({
    color: layer.color,
    amplitude: layer.amplitude,
    glow: layer.glow,
    thickness: layer.thickness,
  }));

  return (
    <ShaderScene>
      <Waves
        amplitude={params.amplitude}
        baseline={params.baseline}
        frequency={params.frequency}
        glow={params.glow}
        layers={layers}
        speed={params.speed}
        thickness={params.thickness}
      />
      {children}
    </ShaderScene>
  );
}
