'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { DotFieldShader } from './shader';

export interface DotFieldProps {
  /** Grid cell size in pixels. */
  spacing?: AnimatableProp<number>;
  /** Dot radius in pixels. */
  dotSize?: AnimatableProp<number>;
  /** Dot color — hex, `oklch()`, or `oklab()`. */
  color?: string;
  /** Ripple travel speed (rings expand faster as this grows). */
  speed?: AnimatableProp<number>;
  /** Peak radial displacement, as a fraction of `spacing` (≈0–0.9). */
  amplitude?: AnimatableProp<number>;
  /** Distance between wave crests, in pixels. */
  wavelength?: AnimatableProp<number>;
  /** How quickly ripples fade with distance from `center`. 0 = no decay (uniform field). */
  decay?: AnimatableProp<number>;
  /** Ripple origin in normalized UV; `[0.5, 0.5]` is centered. */
  center?: [number, number];
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
