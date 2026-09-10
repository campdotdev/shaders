'use client';

import type { ReactNode } from 'react';

import { MeshGradient, RadialWipe, ShaderScene } from '@camp-dev/shaders';

import { INITIAL, type RadialWipeParams } from './params';

export default function RadialWipeScene({
  params = INITIAL,
  children,
}: {
  params?: RadialWipeParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <MeshGradient />
      <RadialWipe
        center={[params.centerX, params.centerY]}
        dissolve={params.dissolve}
        pixelSize={params.pixelSize}
        progress={params.progress}
        tuning={params.tuning}
      />
      {children}
    </ShaderScene>
  );
}
