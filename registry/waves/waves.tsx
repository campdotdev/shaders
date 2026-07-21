'use client';

import type { AnimatableProp } from '@lovo/matter-react';

import { WavesShader } from './shader';

/**
 * A single wave line. Each numeric field scales the matching global prop
 * for this line only; omit a field to use the global value as-is.
 */
export interface WaveLayer {
  /** Line color — hex, `oklch()`, or `oklab()`. */
  color?: string;
  /** This line's wave height. */
  amplitude?: number;
  /** This line's brightness. */
  glow?: number;
  /** This line's width. */
  thickness?: number;
}

export interface WavesProps {
  /** The wave lines to draw. Lines emit light additively — overlaps brighten. */
  layers?: WaveLayer[];
  /**
   * Wave height of the bundle, as a fraction of half the canvas height.
   * 0 = flat lines. Defaults to 0.2. Accepts a static value or an animation
   * signal.
   */
  amplitude?: AnimatableProp<number>;
  /**
   * Wave count across the canvas width, shared by every line. Defaults to
   * 1. Accepts a static value or an animation signal.
   */
  frequency?: AnimatableProp<number>;
  /**
   * Drift rate of the wave motion, shared by every line. 0 freezes the
   * lines. Defaults to 1. Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * Master brightness of the lines. 0 = invisible. Defaults to 0.72.
   * Accepts a static value or an animation signal.
   */
  glow?: AnimatableProp<number>;
  /**
   * Master line width. Larger values give broader, softer lines. Defaults
   * to 0.65. Accepts a static value or an animation signal.
   */
  thickness?: AnimatableProp<number>;
  /**
   * Vertical shift applied to all lines, as a fraction of half the canvas
   * height. Positive lifts, negative drops. Defaults to 0.08. Accepts a
   * static value or an animation signal.
   */
  baseline?: AnimatableProp<number>;
}

// Interim default layer set — Task 7 replaces it with the redesigned
// 8-line palette.
export const DEFAULT_LAYERS: WaveLayer[] = [
  { color: '#ff6f6a', amplitude: 0.14, glow: 0.55, thickness: 0.45 }, // palette.red.light
  { color: '#ecb100', amplitude: 0.17, glow: 0.62, thickness: 0.55 }, // palette.amber.base
  { color: '#0ae24b', amplitude: 0.2, glow: 0.7, thickness: 0.65 }, // palette.green.base
  { color: '#4370f0', amplitude: 0.23, glow: 0.78, thickness: 0.75 }, // palette.blue.light
];

export function Waves({
  layers = DEFAULT_LAYERS,
  amplitude = 0.2,
  frequency = 1,
  speed = 1,
  glow = 0.72,
  thickness = 0.65,
  baseline = 0.08,
}: WavesProps) {
  return (
    <WavesShader
      amplitude={amplitude}
      baseline={baseline}
      frequency={frequency}
      glow={glow}
      layers={layers}
      speed={speed}
      thickness={thickness}
    />
  );
}
