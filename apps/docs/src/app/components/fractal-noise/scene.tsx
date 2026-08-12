'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { FractalNoise } from '@matter/registry/fractal-noise';
import type { ColorStop } from '@matter/registry/fractal-noise';

import { INITIAL, type Params } from './params';

export default function FractalNoiseScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  const stops: ColorStop[] = params.stops;

  return (
    <ShaderScene>
      <FractalNoise
        balance={params.balance}
        colorSpace={params.colorSpace}
        contrast={params.contrast}
        detail={params.detail}
        hueInterpolation={params.hueInterpolation}
        octaves={params.octaves}
        scale={params.scale}
        seed={params.seed}
        softness={params.softness}
        speed={params.speed}
        stops={stops}
        style={params.style}
        tuning={params.tuning}
      />
      {children}
    </ShaderScene>
  );
}
