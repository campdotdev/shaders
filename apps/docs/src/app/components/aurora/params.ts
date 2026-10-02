import type { ColorSpace, HueInterpolation } from '@camp-dev/shaders';

import { paletteOklch } from '../../../lib/palette';

export interface PlainColorStop {
  color: string;
  position: number;
}

export interface AuroraParams {
  intensity: number;
  speed: number;
  waviness: number;
  coverage: number;
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
  stops: PlainColorStop[];
}

// Aurora's stills at INITIAL, from scripts/build-posters.sh, shown before the
// scene's first frame. The demo's poster is 3:2, like its box. The homepage
// hero's is captured at the hero's own shape, because a 3:2 poster
// cover-cropped into the wider hero doesn't line up with the live scene
// (build-posters.sh explains why).
export const POSTER_SRC = '/posters/aurora.jpg';
export const HERO_POSTER_SRC = '/posters/aurora-hero.jpg';

export const MIN_STOPS = 2;
export const MAX_STOPS = 6;

// Approved by eye at the MAT-48 gates; keep in sync with the Aurora defaults.
export const INITIAL: AuroraParams = {
  intensity: 1,
  speed: 1,
  waviness: 1,
  coverage: 1,
  colorSpace: 'oklab',
  hueInterpolation: 'shorter',
  stops: [
    { color: paletteOklch.green[10], position: 0 },
    { color: paletteOklch.teal[9], position: 0.35 },
    { color: paletteOklch.sky[9], position: 0.7 },
    { color: paletteOklch.magenta[8], position: 1 },
  ],
};
