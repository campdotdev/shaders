'use client';

// Public face of the wave lines: owns the props, their JSDoc, and their
// defaults, then delegates to WaveLinesShader (./shader.tsx), which draws a
// bundle of waving ribbons — each a solid body plus an additive light halo —
// sharing one wave so they move as a coherent group. Render it inside a
// <ShaderScene>.
import type { ColorSpace } from '@lovo/matter';
import type { AnimatableProp } from '@lovo/matter-react';

import { WaveLinesShader } from './shader';

/** A single wave line: a flat color or a gradient along its length. */
export interface WaveLine {
  /** Single color, or 2+ stops forming a gradient along the line — hex, `oklch()`, or `oklab()`. */
  color?: string | string[];
}

export interface WaveLinesProps {
  /**
   * The wave lines to draw. Bodies are surfaces — the first line is
   * frontmost and covers those behind it per its opacity — while halos
   * add as light. The first line breathes deepest; later lines calm
   * toward the back.
   */
  lines?: WaveLine[];
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
   * lines. Defaults to 0.5. Accepts a static value or an animation signal.
   */
  speed?: AnimatableProp<number>;
  /**
   * Edge softness and halo reach, 0..1. 0 = a crisp ribbon with a tight
   * edge; 1 = a long soft haze. Shape only — brightness controls the
   * halo's light. Defaults to 0.75. Accepts a static value or an
   * animation signal.
   */
  softness?: AnimatableProp<number>;
  /**
   * Halo luminosity. 0 = no halo — a bare hard-edged ribbon; 1 = the
   * neutral look; higher values drive the halo hot. The body stays
   * pinned at its color. Defaults to 1. Accepts a static value or an
   * animation signal.
   */
  brightness?: AnimatableProp<number>;
  /**
   * Body opacity, 0..1. 0 = no body — lines render as pure light; 1 =
   * solid ribbons that cover the lines behind them. Halos are unaffected.
   * Defaults to 0.85. Accepts a static value or an animation signal.
   */
  opacity?: AnimatableProp<number>;
  /**
   * Master line width. Larger values give broader lines. Defaults to
   * 3.75. Accepts a static value or an animation signal.
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
   * that scrolls as one. 1 gives a lively weave. Defaults to 0.
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
   * At 1.5 lines are 2.5× wider at full flare. Defaults to 2. Accepts a
   * static value or an animation signal.
   */
  flare?: AnimatableProp<number>;
  /**
   * Distance from the focal point at which the fray reaches full width,
   * 0..1 canvas half-widths. Defaults to 0.92. Accepts a static value or
   * an animation signal.
   */
  flareRadius?: AnimatableProp<number>;
  /**
   * Rate the gradient slides along each line. 0 pins it to the canvas.
   * Defaults to 0.7. Accepts a static value or an animation signal.
   */
  colorDrift?: AnimatableProp<number>;
  /** Interpolation space for gradient lines. Defaults to oklab. */
  colorSpace?: ColorSpace;
}

// Default line set: an 8-line analogous cyan→magenta bundle drawn from the
// brand palette's accent scales. Each line takes one rung of the shared
// twelve-step lightness ladder — rung 10 at the front down to rung 3 at the
// back — so depth comes from the ladder rather than hand-picked lightnesses.
// Each line's two stops are adjacent accents, giving a hue gradient of roughly
// 24–31° along its length (so colorDrift is visible out of the box). Interior
// line pairs (1–2, 3–4, 5–6) share a hue pair and differ only by rung, while
// lines 0 and 7 carry unique hue pairs at the arc ends, an efficient packing
// of eight lines across a six-accent arc on a 30° hue grid.
export const DEFAULT_LINES: WaveLine[] = [
  // palette.sky[10], palette.cyan[10]
  { color: ['oklch(0.863 0.083 235)', 'oklch(0.863 0.150 205)'] },
  // palette.blue[9], palette.sky[9]
  { color: ['oklch(0.720 0.116 265.847)', 'oklch(0.720 0.184 235)'] },
  // palette.blue[8], palette.sky[8]
  { color: ['oklch(0.650 0.169 265.847)', 'oklch(0.650 0.173 235)'] },
  // palette.violet[7], palette.blue[7]
  { color: ['oklch(0.549 0.298 293.328)', 'oklch(0.549 0.248 265.847)'] },
  // palette.violet[6], palette.blue[6]
  { color: ['oklch(0.460 0.248 293.328)', 'oklch(0.460 0.313 265.847)'] },
  // palette.purple[5], palette.violet[5]
  { color: ['oklch(0.395 0.167 320)', 'oklch(0.395 0.196 293.328)'] },
  // palette.purple[4], palette.violet[4]
  { color: ['oklch(0.346 0.132 320)', 'oklch(0.346 0.155 293.328)'] },
  // palette.magenta[3], palette.purple[3]
  { color: ['oklch(0.303 0.094 343.895)', 'oklch(0.303 0.102 320)'] },
];

export function WaveLines({
  lines = DEFAULT_LINES,
  amplitude = 0.2,
  frequency = 1,
  speed = 0.5,
  softness = 0.75,
  brightness = 1,
  opacity = 0.85,
  thickness = 3.75,
  baseline = 0,
  braiding = 0,
  breathing = 0.5,
  flare = 2,
  flareRadius = 0.92,
  colorDrift = 0.7,
  colorSpace = 'oklab',
}: WaveLinesProps) {
  return (
    <WaveLinesShader
      amplitude={amplitude}
      baseline={baseline}
      braiding={braiding}
      breathing={breathing}
      brightness={brightness}
      colorDrift={colorDrift}
      colorSpace={colorSpace}
      flare={flare}
      flareRadius={flareRadius}
      frequency={frequency}
      lines={lines}
      opacity={opacity}
      softness={softness}
      speed={speed}
      thickness={thickness}
    />
  );
}
