'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@lovo/matter-react';
import { Dither } from '@matter/registry/dither';
import { MeshGradient } from '@matter/registry/mesh-gradient';

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
      <Dither levels={params.levels} pattern={params.pattern} pixelSize={params.pixelSize} />
      {children}
    </ShaderScene>
  );
}
