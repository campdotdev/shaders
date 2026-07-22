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
  const layers: WaveLayer[] = params.layers.map((layer) => {
    const [firstColor] = layer.colors;

    return {
      color: layer.colors.length === 1 && firstColor !== undefined ? firstColor : layer.colors,
      amplitude: layer.amplitude,
      glow: layer.glow,
      thickness: layer.thickness,
    };
  });

  return (
    <ShaderScene>
      <Waves
        amplitude={params.amplitude}
        baseline={params.baseline}
        braiding={params.braiding}
        breathing={params.breathing}
        colorDrift={params.colorDrift}
        colorSpace={params.colorSpace}
        flare={params.flare}
        flareRadius={params.flareRadius}
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
