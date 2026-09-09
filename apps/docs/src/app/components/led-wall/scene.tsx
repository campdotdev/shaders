'use client';

import type { ReactNode } from 'react';

import { LedWall, MeshGradient, ShaderScene } from '@camp-dev/shaders';

import { INITIAL, type LedWallParams } from './params';

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
        center={[params.centerX, params.centerY]}
        dotSize={params.dotSize}
        flicker={params.flicker}
        progress={params.progress}
        spacing={params.spacing}
        tuning={params.tuning}
        waviness={params.waviness}
      />
      {children}
    </ShaderScene>
  );
}
