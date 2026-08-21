'use client';

// Public face of the fractal-noise field: owns the props, their JSDoc, and
// their defaults, then delegates to FractalNoiseShader (./shader.tsx), which
// sums several octaves of noise per pixel and maps the result onto a color
// ramp. Render it inside a <ShaderScene>.
import type { ColorSpace, HueInterpolation } from '@camp-dev/shaders';
import type { AnimatableProp } from '@camp-dev/shaders-react';

import type { ColorStop } from '../utils/color';
import { FractalNoiseShader, type FractalNoiseStyle } from './shader';
import { STYLE_DIAL_DEFAULTS } from './style-dial-defaults';

export type { ColorStop } from '../utils/color';
export type { FractalNoiseStyle } from './shader';

export interface FractalNoiseProps {
  /**
   * Texture character. 'clouds' is plain layered fBm; 'smoke' folds each
   * layer into soft rounded billows; 'veins' folds sharper, leaving a
   * network of crisp bright creases. Defaults to 'clouds'.
   */
  style?: FractalNoiseStyle;
  /**
   * Colors of the ramp the noise field maps onto. Accepts hex, `oklch()`,
   * or `oklab()`; positions auto-space when omitted.
   */
  stops?: ColorStop[];
  /**
   * Zoom of the noise field — roughly how many broad noise features span
   * the canvas; finer octaves layer detail on top. Defaults to 3. Accepts a
   * static value or an animation signal.
   */
  scale?: AnimatableProp<number>;
  /**
   * How fast the pattern morphs over time. 0 freezes the pattern. Defaults
   * to 0.2. Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * Number of noise layers summed, 1-8. More octaves add finer detail at
   * higher cost. Defaults to 4.
   */
  octaves?: number;
  /**
   * How strongly the finer layers show through, 0-1. 0 leaves only the
   * broadest layer; 1 gives every layer near-equal weight. Defaults to 0.5.
   * Accepts a static value or an animation signal.
   */
  detail?: AnimatableProp<number>;
  /**
   * Pushes noise values toward the ramp extremes. 1 is neutral; above 1
   * leans into the first and last colors, below 1 pulls everything toward
   * the middle stops. Defaults to 1.75 for clouds and smoke, and to 1 for
   * veins. Accepts a static value or an animation signal.
   */
  contrast?: AnimatableProp<number>;
  /**
   * Shifts the whole pattern through the color ramp. 0.5 is neutral; below
   * leans toward the first colors, above leans toward the last. In 2-color
   * mode this reads as a dark/light balance. Defaults to 0.52 for clouds and
   * smoke, and to 0.8 for veins. Accepts a static value or an animation
   * signal.
   */
  balance?: AnimatableProp<number>;
  /**
   * Blends between posterized contour bands and a smooth gradient. 0 = hard
   * bands (one per color stop); 1 = fully smooth. Defaults to 1. Accepts a
   * static value or an animation signal.
   */
  softness?: AnimatableProp<number>;
  /**
   * Static offset of the noise pattern. Change it for a different layout of
   * the same character. Defaults to 0.
   */
  seed?: number;
  /** Color space the ramp is interpolated in. Defaults to `'oklab'`. */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
  hueInterpolation?: HueInterpolation;
}

// Twilight palette: stops walk the shared lightness ladder so each is at least
// 0.10 lighter than the one before, creating depth that makes the ramp readable.
const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.196 0.025 235)' }, // paletteOklch.sky[1]
  { color: 'oklch(0.346 0.198 265.847)' }, // paletteOklch.blue[4]
  { color: 'oklch(0.460 0.248 293.328)' }, // paletteOklch.violet[6]
  { color: 'oklch(0.720 0.250 320)' }, // paletteOklch.purple[9]
  { color: 'oklch(0.932 0.047 343.895)' }, // paletteOklch.magenta[11]
];

export function FractalNoise({
  style = 'clouds',
  stops = DEFAULT_STOPS,
  scale = 3,
  speed = 0.2,
  octaves = 4,
  detail = 0.5,
  contrast,
  balance,
  softness = 1,
  seed = 0,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: FractalNoiseProps) {
  // These two can't default inline like the rest: their defaults follow the
  // style prop (see ./style-dial-defaults.ts).
  const styleDials = STYLE_DIAL_DEFAULTS[style];
  const resolvedContrast = contrast ?? styleDials.contrast;
  const resolvedBalance = balance ?? styleDials.balance;

  return (
    <FractalNoiseShader
      balance={resolvedBalance}
      colorSpace={colorSpace}
      contrast={resolvedContrast}
      detail={detail}
      hueInterpolation={hueInterpolation}
      octaves={octaves}
      scale={scale}
      seed={seed}
      softness={softness}
      speed={speed}
      stops={stops}
      style={style}
    />
  );
}
