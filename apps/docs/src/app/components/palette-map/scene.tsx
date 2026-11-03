'use client';

import type { ReactNode } from 'react';

import { FractalNoise, PaletteMap, ShaderScene } from '@camp-dev/shaders';

import { INITIAL, type PaletteMapParams } from './params';

// Black to white, so the noise's lightness can cover the full range.
// FractalNoise mixes in OKLab by default, so its lightness rises evenly with
// the noise value. Its values bunch around the middle, so NOISE_CONTRAST
// pushes them out toward black and white until every palette color takes a
// similar share. At the default contrast the first color barely shows.
const GRAY_STOPS = [{ color: 'oklch(0 0 0)' }, { color: 'oklch(1 0 0)' }];
const NOISE_CONTRAST = 3.5;

export default function PaletteMapScene({
  params = INITIAL,
  children,
}: {
  params?: PaletteMapParams;
  children?: ReactNode;
} = {}) {
  return (
    <ShaderScene>
      <FractalNoise contrast={NOISE_CONTRAST} stops={GRAY_STOPS} />
      <PaletteMap colors={params.colors} pixelSize={params.pixelSize} spread={params.spread} />
      {children}
    </ShaderScene>
  );
}
