'use client';

// Public face of the Voronoi mosaic: owns the props, their JSDoc, and their
// defaults, then delegates to VoronoiShader (./shader.tsx), which carves the
// canvas into cells around scattered seed points and colors each cell from
// the ramp. Render it inside a <ShaderScene>.
import type { AnimatableProp } from '@lovo/matter-react';

import type { ColorStop } from '../utils/color';
import { VoronoiShader, type VoronoiTuning } from './shader';

export type { ColorStop } from '../utils/color';
export type { VoronoiTuning } from './shader';

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
  /**
   * How fast cells drift over time. 0 freezes the pattern. Defaults to 0.2.
   * Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * How far seeds scatter off a perfect grid. 0 arranges cells in an exact
   * square grid; 1 is fully organic. Static — motion is governed by `drift`
   * and `speed`. Defaults to 1. Accepts a static value or an animation
   * signal.
   */
  irregularity?: AnimatableProp<number>;
  /**
   * How far cells wobble around their home positions while animating. 0
   * pins them in place even at high speed; 1 lets each seed roam all the
   * room its cell offers, so walls slide and cells reshape. Defaults to
   * 0.5. Accepts a static value or an animation signal.
   */
  drift?: AnimatableProp<number>;
  /**
   * Color of the border lines between cells. Defaults to a near-black
   * neutral.
   */
  borderColor?: string;
  /**
   * Width of the border between cells. 0 removes borders entirely (cells
   * touch seamlessly); 1 is chunky mortar. Defaults to 0.05. Accepts a
   * static value or an animation signal.
   */
  borderWidth?: AnimatableProp<number>;
  /**
   * How soft the border edge is. 0 is a crisp anti-aliased line; 1 fades
   * the border into the cells as a wide mist. Defaults to 0. Accepts a
   * static value or an animation signal.
   */
  borderSoftness?: AnimatableProp<number>;
  /**
   * TEMPORARY dev-tuning overrides for feel constants. Stripped before
   * release — do not use.
   */
  tuning?: VoronoiTuning;
}

// Deep-water palette: stops walk the shared lightness ladder (each ≥0.10 L
// above the one before) so neighboring cells read as depth, not hue soup.
const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.196 0.025 235)' }, // paletteOklch.sky[1]
  { color: 'oklch(0.346 0.198 265.847)' }, // paletteOklch.blue[4]
  { color: 'oklch(0.460 0.248 293.328)' }, // paletteOklch.violet[6]
  { color: 'oklch(0.720 0.250 320)' }, // paletteOklch.purple[9]
];

export function Voronoi({
  stops = DEFAULT_STOPS,
  scale = 5,
  seed = 0,
  speed = 0.2,
  irregularity = 1,
  drift = 0.5,
  borderColor = 'oklch(0.145 0.02 265)',
  borderWidth = 0.05,
  borderSoftness = 0,
  tuning,
}: VoronoiProps) {
  return (
    <VoronoiShader
      borderColor={borderColor}
      borderSoftness={borderSoftness}
      borderWidth={borderWidth}
      drift={drift}
      irregularity={irregularity}
      scale={scale}
      seed={seed}
      speed={speed}
      stops={stops}
      tuning={tuning}
    />
  );
}
