// TEMPORARY. The banner's feel constants as a `tuning` prop while the scene
// is built by eye on /dev/banner-probe (SHA-144), whose panel writes into
// them live. Its own file, with no path to three, because the probe imports
// the defaults for its store and banner-scene.tsx cannot be imported on the
// server (the three/webgpu gotcha). At the defaults gate this file, the
// prop, and the probe go, and the landed values become named constants in
// banner-scene.tsx.
import type { DitherPattern } from '@camp-dev/shaders';

export interface BannerTuning {
  /** The wash's center color. The ramp runs from here out to the page black. */
  glowColor: string;
  /** Dot pitch in CSS pixels. Keep it a multiple of the Bayer tile, see banner-scene.tsx. */
  spacing: number;
  /** Dot diameter in CSS pixels, before Dither carves it into cells. */
  dotSize: number;
  /**
   * The dot's flat color. Under Dither this sets HOW MANY of a dot's cells
   * light up, not how bright they are: a cell lights when the color clears
   * that cell's Bayer threshold, so a darker gray lights fewer cells.
   */
  dotColor: string;
  /** Dither cell edge in CSS pixels. */
  pixelSize: number;
  /**
   * Quantization steps per channel. This is what sets the lit cells'
   * brightness: at 2 they are white, at 4 the first step up from black is a
   * third gray, at 6 a fifth.
   */
  levels: number;
  /** Strength of the Bayer push, 1 for classic ordered dithering. */
  spread: number;
  /** The threshold map. Bayer 4x4 is the one whose highest five cells form an x. */
  pattern: DitherPattern;
}

export const BANNER_TUNING: BannerTuning = {
  glowColor: 'oklch(0.22 0.04 130)',
  spacing: 24,
  dotSize: 6,
  dotColor: 'oklch(0.2 0 0)',
  pixelSize: 2,
  levels: 4,
  spread: 1,
  pattern: 'bayer-4x4',
};
