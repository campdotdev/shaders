'use client';

import type { ColorSpace } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import { WavesShader } from './shader';

/**
 * A single wave line. Each numeric field scales the matching global prop
 * for this line only; omit a field to use the global value as-is.
 */
export interface WaveLayer {
  /** Single color, or 2+ stops forming a gradient along the line — hex, `oklch()`, or `oklab()`. */
  color?: string | string[];
  /** This line's wave height. */
  amplitude?: number;
  /** This line's brightness. */
  glow?: number;
  /** This line's width. */
  thickness?: number;
}

export interface WavesProps {
  /**
   * The wave lines to draw. Lines emit light additively — overlaps
   * brighten. The first line breathes deepest; later lines calm toward the
   * back.
   */
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
   * height. Positive lifts, negative drops. Defaults to 0. Accepts a
   * static value or an animation signal.
   */
  baseline?: AnimatableProp<number>;
  /**
   * How restlessly lines weave apart and re-converge. 0 = a frozen braid
   * that scrolls as one. 1 matches the reference feel. Defaults to 0.
   * Accepts a static value or an animation signal.
   */
  braiding?: AnimatableProp<number>;
  /**
   * Depth of the slow height pulse. 0 = steady heights, 1 = full swell
   * (lines double at the peak and flatten at the trough). Defaults to 0.5.
   * Accepts a static value or an animation signal.
   */
  breathing?: AnimatableProp<number>;
  /**
   * How strongly lines fray wide at the ends. 0 = uniform width everywhere.
   * At 1.5 lines are 2.5× wider at full flare. Defaults to 1.5. Accepts a
   * static value or an animation signal.
   */
  flare?: AnimatableProp<number>;
  /**
   * Distance from the focal point at which the fray reaches full width,
   * 0..1 canvas half-widths. Defaults to 0.9. Accepts a static value or an
   * animation signal.
   */
  flareRadius?: AnimatableProp<number>;
  /**
   * Rate the gradient slides along each line. 0 pins it to the canvas.
   * Defaults to 0.15. Accepts a static value or an animation signal.
   */
  colorDrift?: AnimatableProp<number>;
  /** Interpolation space for gradient lines. Defaults to oklab. */
  colorSpace?: ColorSpace;
}

// Default layer set: an 8-line analogous blue→violet bundle. Each line is a
// gentle 30° hue gradient along its length (so colorDrift is visible out of
// the box); lightness falls along the array for depth; all other per-line
// fields ride the globals — variation comes from the movement system. The
// hue run (205→340) tracks the brand palette's cool accent arc
// (sky→blue→violet→purple).
export const DEFAULT_LAYERS: WaveLayer[] = [
  { color: ['oklch(0.85 0.12 205)', 'oklch(0.85 0.12 235)'] },
  { color: ['oklch(0.8 0.14 220)', 'oklch(0.8 0.14 250)'] },
  { color: ['oklch(0.75 0.16 235)', 'oklch(0.75 0.16 265)'] },
  { color: ['oklch(0.7 0.17 250)', 'oklch(0.7 0.17 280)'] },
  { color: ['oklch(0.65 0.17 265)', 'oklch(0.65 0.17 295)'] },
  { color: ['oklch(0.6 0.16 280)', 'oklch(0.6 0.16 310)'] },
  { color: ['oklch(0.55 0.15 295)', 'oklch(0.55 0.15 325)'] },
  { color: ['oklch(0.5 0.13 310)', 'oklch(0.5 0.13 340)'] },
];

export function Waves({
  layers = DEFAULT_LAYERS,
  amplitude = 0.2,
  frequency = 1,
  speed = 1,
  glow = 0.72,
  thickness = 0.65,
  baseline = 0,
  braiding = 0,
  breathing = 0.5,
  flare = 1.5,
  flareRadius = 0.9,
  colorDrift = 0.15,
  colorSpace = 'oklab',
}: WavesProps) {
  return (
    <WavesShader
      amplitude={amplitude}
      baseline={baseline}
      braiding={braiding}
      breathing={breathing}
      colorDrift={colorDrift}
      colorSpace={colorSpace}
      flare={flare}
      flareRadius={flareRadius}
      frequency={frequency}
      glow={glow}
      layers={layers}
      speed={speed}
      thickness={thickness}
    />
  );
}
