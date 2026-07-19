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
  /** This line's wave count across the canvas width. */
  frequency?: number;
  /** This line's drift rate. */
  speed?: number;
  /** This line's brightness. */
  glow?: number;
  /** This line's width. */
  thickness?: number;
  /** Phase offset in radians, sliding the line's wave pattern horizontally. */
  offset?: number;
  /** Extra fine wobble on top of this line's base wave. 0 = a pure smooth wave. */
  waviness?: number;
}

export interface WavesProps {
  /** The wave lines to draw. Lines emit light additively — overlaps brighten. */
  layers?: WaveLayer[];
  /**
   * Master wave height, as a fraction of half the canvas height. 0 = flat
   * lines. Defaults to 0.09. Accepts a static value or an animation signal.
   */
  amplitude?: AnimatableProp<number>;
  /**
   * Master wave count across the canvas width. Defaults to 1. Accepts a
   * static value or an animation signal.
   */
  frequency?: AnimatableProp<number>;
  /**
   * Master drift rate of the wave motion. 0 freezes the lines. Defaults to
   * 1. Accepts a static value or an animation signal.
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

// Default layer set: red → amber → green → blue rainbow progression with
// staggered offsets so each layer is easy to distinguish.
export const DEFAULT_LAYERS: WaveLayer[] = [
  {
    color: '#ff6f6a',
    amplitude: 0.045,
    frequency: 0.75,
    speed: 0.55,
    glow: 0.55,
    thickness: 0.45,
    offset: 0,
    waviness: 0.12,
  }, // palette.red.light
  {
    color: '#ecb100',
    amplitude: 0.065,
    frequency: 1.05,
    speed: 0.8,
    glow: 0.62,
    thickness: 0.55,
    offset: 1.57,
    waviness: 0.32,
  }, // palette.amber.base
  {
    color: '#0ae24b',
    amplitude: 0.09,
    frequency: 1.35,
    speed: 1.05,
    glow: 0.7,
    thickness: 0.65,
    offset: 3.14,
    waviness: 0.52,
  }, // palette.green.base
  {
    color: '#4370f0',
    amplitude: 0.115,
    frequency: 1.7,
    speed: 1.3,
    glow: 0.78,
    thickness: 0.75,
    offset: 4.71,
    waviness: 0.72,
  }, // palette.blue.light
];

export function Waves({
  layers = DEFAULT_LAYERS,
  amplitude = 0.09,
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
