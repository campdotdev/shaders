'use client';

import type { ReactNode } from 'react';

import { LedWall, MeshGradient, ShaderScene, useCursor } from '@camp-dev/shaders';

import { INITIAL, type LedWallParams } from './params';

/**
 * Where the wall's focus sits before the pointer first moves: one canvas
 * height below the bottom edge, in the same 0..1 frame as `focus`. The
 * cursor input otherwise seeds at the canvas center, which would swell a
 * cluster of dots in the middle of the demo, and of the poster rendered from
 * this scene, for a pointer that is not there. The first real pointer move
 * brings the focus in from below.
 */
const FOCUS_PARKED: readonly [number, number] = [0.5, 2];

/**
 * The wall with the pointer as its focus. useCursor reads the scene's
 * canvas from context, so this has to render inside the ShaderScene.
 */
function CursorLedWall({ params }: { params: LedWallParams }) {
  const cursor = useCursor({ initial: FOCUS_PARKED });

  return (
    <LedWall
      bleed={params.bleed}
      dotSize={params.dotSize}
      flicker={params.flicker}
      focus={cursor}
      focusRadius={params.focusRadius}
      spacing={params.spacing}
      speed={params.speed}
      swell={params.swell}
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
