'use client';

import type { ReactNode } from 'react';

import { CursorSpotlight, RadialGradient, ShaderScene } from '@camp-dev/shaders';

import { type CursorSpotlightParams, INITIAL } from './params';

// RadialGradient sits beneath because it votes static at its default speed
// of 0, so the page parks while the pointer is still, the way a real
// spotlight scene should.
export default function CursorSpotlightScene({
  params = INITIAL,
  children,
}: {
  params?: CursorSpotlightParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <RadialGradient />
      <CursorSpotlight intensity={params.intensity} radius={params.radius} />
      {children}
    </ShaderScene>
  );
}
