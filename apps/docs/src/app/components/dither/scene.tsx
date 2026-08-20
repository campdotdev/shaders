'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@mattermix/shaders-react';
import { Dither } from '@shaders/registry/dither';
import { MeshGradient } from '@shaders/registry/mesh-gradient';

import { type DitherParams, INITIAL } from './params';

export default function DitherScene({
  params = INITIAL,
  children,
}: {
  params?: DitherParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <MeshGradient />
      <Dither
        levels={params.levels}
        pattern={params.pattern}
        pixelSize={params.pixelSize}
        spread={params.spread}
        threshold={params.threshold}
      />
      {children}
    </ShaderScene>
  );
}
