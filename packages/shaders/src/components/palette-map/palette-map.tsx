'use client';

// Public face of the palette map: owns the props, their JSDoc, and their
// defaults, then delegates to PaletteMapShader (./shader.tsx). PaletteMap is
// an Effect: stack it after other components inside a <ShaderScene> and it
// repaints everything beneath it in a few chosen colors, picked by how light
// the image is at each point, with scattered cells where two colors meet.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { PaletteMapShader } from './shader.js';

// Dark to light, each step at least 0.15 of OKLCH lightness above the last,
// so the bands stay apart however the hues sit: deep violet, magenta, coral,
// pale gold.
const DEFAULT_COLORS = [
  'oklch(0.25 0.06 280)',
  'oklch(0.45 0.16 320)',
  'oklch(0.68 0.18 40)',
  'oklch(0.90 0.12 90)',
];

export interface PaletteMapProps {
  /**
   * The palette, darkest input first: the image's darkest areas take the
   * first color and its lightest take the last, with the rest spaced evenly
   * between. 2 or more colors as hex, `oklch()`, or `oklab()` strings.
   * Defaults to a violet-to-gold ramp.
   */
  colors?: string[];
  /**
   * Edge of one cell in CSS pixels. Each cell takes one color. Match it to
   * an LED wall's spacing and each dot takes one color. Defaults to 2.
   * Accepts a static value or an animation signal.
   */
  pixelSize?: AnimatableProp<number>;
  /**
   * How far the two colors at a band edge scatter into each other. 0 draws
   * clean edges, 1 mixes them across the whole step between two colors, and
   * above 1 scatters stray cells into flat areas too. Defaults to 0.5. Accepts
   * a static value or an animation signal.
   */
  spread?: AnimatableProp<number>;
}

export function PaletteMap({
  colors = DEFAULT_COLORS,
  pixelSize = 2,
  spread = 0.5,
}: PaletteMapProps) {
  return <PaletteMapShader colors={colors} pixelSize={pixelSize} spread={spread} />;
}
