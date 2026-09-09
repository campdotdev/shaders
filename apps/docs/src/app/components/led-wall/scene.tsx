'use client';

import type { ReactNode } from 'react';

import { LedWall, MeshGradient, ShaderScene, useCursor } from '@camp-dev/shaders';

import { INITIAL, type LedWallParams } from './params';

/**
 * The wall with the pointer on its spotlight. useCursor reads the scene's
 * canvas from context, so this has to render inside the ShaderScene.
 */
function CursorLedWall({ params }: { params: LedWallParams }) {
  const cursor = useCursor();

  return (
    <LedWall
      bleed={params.bleed}
      center={[params.centerX, params.centerY]}
      dotSize={params.dotSize}
      flicker={params.flicker}
      progress={params.progress}
      spacing={params.spacing}
      speed={params.speed}
      spotlight={cursor}
      spotlightIntensity={params.spotlightIntensity}
      spotlightRadius={params.spotlightRadius}
      tuning={params.tuning}
      waviness={params.waviness}
    />
  );
}

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
      <CursorLedWall params={params} />
      {children}
    </ShaderScene>
  );
}
