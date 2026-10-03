'use client';

import type { ReactNode } from 'react';

import { Dither, MeshGradient, ShaderScene } from '@camp-dev/shaders';

import { type DitherParams, INITIAL } from './params';

export default function DitherScene({
  params = INITIAL,
  children,
  paused,
}: {
  params?: DitherParams;
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
      <MeshGradient />
      <Dither
        levels={params.levels}
        pattern={params.pattern}
        pixelSize={params.pixelSize}
        spread={params.spread}
        threshold={params.threshold}
      />
      {children}
    </ShaderScene>
  );
}
