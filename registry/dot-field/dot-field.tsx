'use client';

// Public face of the dot field: owns the props, their JSDoc, and their
// defaults, then delegates to DotFieldShader (./shader.tsx), which draws a
// pixel-spaced grid of dots and ripples them outward from a center point.
// Render it inside a <ShaderScene>; the gaps between dots are transparent,
// so it can sit over other layers.
import type { AnimatableProp } from '@mattermix/shaders-react';

import { DotFieldShader } from './shader';

export interface DotFieldProps {
  /**
   * Grid cell size in pixels. Defaults to 30. Accepts a static value or an
   * animation signal.
   */
  spacing?: AnimatableProp<number>;
  /**
   * Dot diameter in pixels. Defaults to 3. Accepts a static value or an
   * animation signal.
   */
  dotSize?: AnimatableProp<number>;
  /** Dot color — hex, `oklch()`, or `oklab()`. Defaults to `'#8B918C'`. */
  color?: string;
  /**
   * Ripple travel speed (rings expand faster as this grows). Defaults to
   * 0.45. Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * Peak radial displacement, as a fraction of `spacing` (≈0–0.9). 0 = a
   * static grid. Defaults to 0.15. Accepts a static value or an animation
   * signal.
   */
  amplitude?: AnimatableProp<number>;
  /**
   * Distance between wave crests, in pixels. Defaults to 150. Accepts a
   * static value or an animation signal.
   */
  wavelength?: AnimatableProp<number>;
  /**
   * How quickly ripples decay with distance from `center`. 0 = no decay
   * (uniform field). Defaults to 0.65. Accepts a static value or an
   * animation signal.
   */
  decay?: AnimatableProp<number>;
  /**
   * Ripple origin, 0..1 across the canvas; `[0.5, 0.5]` is centered and
   * `[0, 0]` is the top-left corner. Defaults to `[0.5, 0.5]`. Accepts a
   * static value or an animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
}

export function DotField({
  spacing = 30,
  dotSize = 3,
  color = '#8B918C',
  speed = 0.45,
  amplitude = 0.15,
  wavelength = 150,
  decay = 0.65,
  center = [0.5, 0.5],
}: DotFieldProps) {
  return (
    <DotFieldShader
      amplitude={amplitude}
      center={center}
      color={color}
      decay={decay}
      dotSize={dotSize}
      spacing={spacing}
      speed={speed}
      wavelength={wavelength}
    />
  );
}
