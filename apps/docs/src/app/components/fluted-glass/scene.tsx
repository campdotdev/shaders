'use client';

import type { ReactNode } from 'react';

import { FlutedGlass, MeshGradient, ShaderScene } from '@camp-dev/shaders';

import { type FlutedGlassParams, INITIAL } from './params';

/**
 * MeshGradient at its defaults seen through the glass. FlutedGlass bends
 * only what Sources drew, so it mounts straight after the gradient.
 */
export default function FlutedGlassScene({
  params = INITIAL,
  children,
}: {
  params?: FlutedGlassParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <MeshGradient />
      <FlutedGlass
        angle={params.angle}
        refraction={params.refraction}
        shadow={params.shadow}
        shine={params.shine}
        softness={params.softness}
        speed={params.speed}
        sway={params.sway}
        swayFrequency={params.swayFrequency}
        width={params.width}
      />
      {children}
    </ShaderScene>
  );
}
