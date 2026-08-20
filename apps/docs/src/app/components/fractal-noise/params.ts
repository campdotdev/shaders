import type { ColorSpace, HueInterpolation } from '@mattermix/shaders';
import type { FractalNoiseStyle } from '@shaders/registry/fractal-noise';
import { STYLE_DIAL_DEFAULTS } from '@shaders/registry/fractal-noise/style-dial-defaults';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
}

export interface Params {
  style: FractalNoiseStyle;
  scale: number;
  speed: number;
  octaves: number;
  detail: number;
  contrast: number;
  balance: number;
  softness: number;
  seed: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 5;

// Values mirror the component defaults in registry/fractal-noise/fractal-noise.tsx
// for the initial style (clouds) — keep the two in sync. Contrast and balance
// come straight from the component's per-style table; the panel's StyleDialSync
// mirrors that on switch.
export const INITIAL: Params = {
  style: 'clouds',
  scale: 3,
  speed: 0.2,
  octaves: 4,
  detail: 0.5,
  contrast: STYLE_DIAL_DEFAULTS.clouds.contrast,
  balance: STYLE_DIAL_DEFAULTS.clouds.balance,
  softness: 1,
  seed: 0,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.sky[1] },
    { color: paletteOklch.blue[4] },
    { color: paletteOklch.violet[6] },
    { color: paletteOklch.purple[9] },
    { color: paletteOklch.magenta[11] },
  ],
};
