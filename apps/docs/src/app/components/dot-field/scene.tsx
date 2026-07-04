'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { DotField } from '@matter/registry/dot-field';

import { INITIAL, type Params } from './params';

export default function DotFieldScene({
  params = INITIAL,
  onFirstPaint,
  children,
}: {
  params?: Params;
  onFirstPaint?: () => void;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene onFirstPaint={onFirstPaint}>
      <DotField
        amplitude={params.amplitude}
        center={[params.centerX, params.centerY]}
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
