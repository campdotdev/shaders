'use client';

// Public face of the Voronoi mosaic: owns the props, their JSDoc, and their
// defaults, then delegates to VoronoiShader (./shader.tsx), which carves the
// canvas into cells around scattered seed points and colors each cell from
// the ramp. Render it inside a <ShaderScene>.
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { VoronoiShader } from './shader';

export type { ColorStop } from '../utils/color';

export interface VoronoiProps {
  /**
   * Palette cells draw from. Each cell picks its color by a stable per-cell
   * random value mapped along this ramp. Accepts hex, `oklch()`, or
   * `oklab()`; positions auto-space when omitted.
   */
  stops?: ColorStop[];
  /**
   * Cell density — roughly how many cells span the canvas height. Higher
   * values give a finer mosaic. Defaults to 5. Accepts a static value or an
   * animation signal.
   */
  scale?: AnimatableProp<number>;
  /**
   * Static offset of the cell layout. Change it for a different arrangement
   * of the same character. Defaults to 0.
   */
  seed?: number;
}

// Deep-water palette: stops walk the shared lightness ladder (each ≥0.10 L
// above the one before) so neighboring cells read as depth, not hue soup.
const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.196 0.025 235)' }, // paletteOklch.sky[1]
  { color: 'oklch(0.346 0.198 265.847)' }, // paletteOklch.blue[4]
  { color: 'oklch(0.460 0.248 293.328)' }, // paletteOklch.violet[6]
  { color: 'oklch(0.720 0.250 320)' }, // paletteOklch.purple[9]
];

export function Voronoi({ stops = DEFAULT_STOPS, scale = 5, seed = 0 }: VoronoiProps) {
  return <VoronoiShader scale={scale} seed={seed} stops={stops} />;
}
