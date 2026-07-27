'use client';

// Public face of the mesh gradient: owns the props, their JSDoc, and their
// defaults, then delegates to MeshGradientShader (./shader.tsx), which
// anchors four colors near the canvas corners, melts the boundaries with a
// noise-driven warp, and cross-fades the whole thing between two palettes.
// Render it inside a <ShaderScene>.
import type { ColorSpace, HueInterpolation } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import type { Palette } from '../utils/color';
import { MeshGradientShader } from './shader';

export type { Palette } from '../utils/color';

export interface MeshGradientProps {
  /**
   * Speed of the flowing warp motion. 0 freezes the flow (palette cycling
   * continues). Defaults to 2. Accepts a static value or an animation
   * signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * How many warp bends appear across the gradient. Higher values give
   * tighter, more numerous bends. Defaults to 5. Accepts a static value or
   * an animation signal.
   */
  frequency?: AnimatableProp<number>;
  /**
   * Warp subtlety — larger values give a weaker, gentler warp; smaller
   * values distort harder. Defaults to 30. Accepts a static value or an
   * animation signal.
   */
  amplitude?: AnimatableProp<number>;
  /**
   * Speed of the cross-fade between the two `palettes`. 0 freezes the
   * cycle. Defaults to 0.5. Accepts a static value or an animation signal.
   */
  cycleSpeed?: AnimatableProp<number>;
  /**
   * Easing of the palette cycle. 1 = a smooth sinusoidal ping-pong; below 1
   * holds each palette longer with snappier transitions; above 1 lingers in
   * the blended middle. Defaults to 0.6. Accepts a static value or an
   * animation signal.
   */
  cycleEase?: AnimatableProp<number>;
  /** Two palettes to cross-fade between as the gradient cycles. */
  palettes?: [Palette, Palette];
  /** Color space the palettes are interpolated in. Defaults to `'oklab'`. */
  colorSpace?: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise. Defaults to `'shorter'`.
   */
  hueInterpolation?: HueInterpolation;
}

// A cool set and a warm set; the shader cross-fades between them over time,
// so the default look breathes from green/teal into amber/red and back.
const DEFAULT_PALETTES: [Palette, Palette] = [
  [
    '#849c00', // palette.lime[8]
    '#00ad36', // palette.green[8]
    '#00a78b', // palette.teal[8]
    '#009bd6', // palette.sky[8]
  ],
  [
    '#b48700', // palette.amber[8]
    '#d76f00', // palette.orange[8]
    '#ff333c', // palette.red[8]
    '#f600b8', // palette.magenta[8]
  ],
];

export function MeshGradient({
  speed = 2,
  frequency = 5,
  amplitude = 30,
  cycleSpeed = 0.5,
  cycleEase = 0.6,
  palettes = DEFAULT_PALETTES,
  colorSpace = 'oklab',
  hueInterpolation = 'shorter',
}: MeshGradientProps) {
  return (
    <MeshGradientShader
      amplitude={amplitude}
      colorSpace={colorSpace}
      cycleEase={cycleEase}
      cycleSpeed={cycleSpeed}
      frequency={frequency}
      hueInterpolation={hueInterpolation}
      palettes={palettes}
      speed={speed}
    />
  );
}
