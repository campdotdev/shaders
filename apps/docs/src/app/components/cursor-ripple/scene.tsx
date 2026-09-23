'use client';

import type { ReactNode } from 'react';

import { CursorRipple, MeshGradient, ShaderScene } from '@camp-dev/shaders';

import { type CursorRippleParams, INITIAL } from './params';

export default function CursorRippleScene({
  params = INITIAL,
  children,
}: {
  params?: CursorRippleParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <MeshGradient />
      <CursorRipple
        decay={params.decay}
        radius={params.radius}
        refraction={params.refraction}
        shine={params.shine}
      />
      {children}
    </ShaderScene>
  );
}
