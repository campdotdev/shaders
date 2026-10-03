'use client';

import type { ReactNode } from 'react';

import { GodRays, ShaderScene } from '@camp-dev/shaders';

import { type GodRaysParams, INITIAL } from './params';

export default function GodRaysScene({
  params = INITIAL,
  children,
  paused,
}: {
  params?: GodRaysParams;
  children?: ReactNode;
  /**
   * Freezes the scene on its current frame, passed to ShaderScene. A homepage
   * favorite pauses it once the pointer and keyboard focus have both left
   * its card.
   */
  paused?: boolean;
} = {}) {
  return (
    <ShaderScene paused={paused}>
      <GodRays
        angle={params.angle}
        center={[params.centerX, params.centerY]}
        colors={params.colors}
        density={params.density}
        diffusion={params.diffusion}
        glowIntensity={params.glowIntensity}
        glowRadius={params.glowRadius}
        intensity={params.intensity}
        patchiness={params.patchiness}
        radius={params.radius}
        speed={params.speed}
        spread={params.spread}
      />
      {children}
    </ShaderScene>
  );
}
