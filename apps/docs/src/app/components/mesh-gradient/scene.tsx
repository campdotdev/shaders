'use client';

import type { ReactNode } from 'react';

import { ShaderScene } from '@camp-dev/shaders-react';
import { MeshGradient, type Palette } from '@shaders/registry/mesh-gradient';

import { INITIAL, type Params } from './params';

const FALLBACK_COLOR = 'oklch(0.6 0.15 250)';

/**
 * The store holds each palette as a plain string[] so the palette list
 * controls can read its length; the component wants a fixed four-color
 * tuple. The panel pins both lists to exactly four items via ListInput's
 * min/max, so the fallback only matters if a caller feeds this scene a
 * malformed params object directly.
 */
const toPalette = (colors: readonly string[]): Palette => {
  const [first, second, third, fourth] = colors;

  return [
    first ?? FALLBACK_COLOR,
    second ?? FALLBACK_COLOR,
    third ?? FALLBACK_COLOR,
    fourth ?? FALLBACK_COLOR,
  ];
};

export default function MeshGradientScene({
  params = INITIAL,
  children,
}: {
  params?: Params;
  children?: ReactNode;
} = {}) {
  const [paletteA, paletteB] = params.palettes;

  return (
    <ShaderScene>
      <MeshGradient
        amplitude={params.amplitude}
        colorSpace={params.colorSpace}
        cycleEase={params.cycleEase}
        cycleSpeed={params.cycleSpeed}
        frequency={params.frequency}
        hueInterpolation={params.hueInterpolation}
        palettes={[toPalette(paletteA), toPalette(paletteB)]}
        speed={params.speed}
      />
      {children}
    </ShaderScene>
  );
}
