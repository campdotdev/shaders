'use client';

import type { ReactNode } from 'react';

import { Dissolve, MeshGradient, ShaderScene } from '@camp-dev/shaders';

import { type DissolveParams, INITIAL } from './params';

export default function DissolveScene({
  params = INITIAL,
  children,
}: {
  params?: DissolveParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <MeshGradient />
      <Dissolve pixelSize={params.pixelSize} progress={params.progress} tuning={params.tuning} />
      {children}
    </ShaderScene>
  );
}
