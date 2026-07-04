'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Waves } from '@matter/registry/waves';
import type { WaveLayer } from '@matter/registry/waves';

import { INITIAL, type Params } from './params';

export default function WavesScene({
  params = INITIAL,
  onFirstPaint,
  children,
}: {
  params?: Params;
  onFirstPaint?: () => void;
  children?: ReactNode;
} = {}) {
  const layers: WaveLayer[] = params.layers.map((layer) => ({
    color: layer.color,
    amplitude: layer.amplitude,
    frequency: layer.frequency,
    speed: layer.speed,
    glow: layer.glow,
    thickness: layer.thickness,
    offset: layer.offset,
    turbulence: layer.turbulence,
  }));

  return (
    <ShaderScene onFirstPaint={onFirstPaint}>
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
