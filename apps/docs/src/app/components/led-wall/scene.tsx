'use client';

import type { ReactNode } from 'react';

import { LedWall, MeshGradient, ShaderScene } from '@camp-dev/shaders';

import { INITIAL, type LedWallParams } from './params';

/**
 * The wall swells toward the pointer through the `"cursor"` shorthand. Until
 * the pointer first moves, LedWall parks the swell below the canvas, so the
 * demo and the poster rendered from this scene show no swell.
 */
export default function LedWallScene({
  params = INITIAL,
  children,
}: {
  params?: LedWallParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <MeshGradient />
      <LedWall
        bleed={params.bleed}
        dotSize={params.dotSize}
        flicker={params.flicker}
        spacing={params.spacing}
        speed={params.speed}
        swell={params.swell}
        swellCenter="cursor"
        swellRadius={params.swellRadius}
      />
      {children}
    </ShaderScene>
  );
}
