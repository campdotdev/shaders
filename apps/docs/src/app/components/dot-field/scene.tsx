'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@camp-dev/shaders-react';
import { DotField } from '@shaders/registry/dot-field';

import { INITIAL, type Params } from './params';

export default function DotFieldScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <DotField
        amplitude={params.amplitude}
        center={params.center}
        color={params.color}
        decay={params.decay}
        dotSize={params.dotSize}
        spacing={params.spacing}
        speed={params.speed}
        wavelength={params.wavelength}
      />
      {children}
    </ShaderScene>
  );
}
