// TEMPORARY. The banner's feel constants as a `tuning` prop while the scene
// is built by eye on /dev/banner-probe (SHA-144), whose panel writes into
// them live. Its own file, with no path to three, because the probe imports
// the defaults for its store and banner-scene.tsx cannot be imported on the
// server (the three/webgpu gotcha). At the defaults gate this file, the
// prop, and the probe go, and the landed values become named constants in
// banner-scene.tsx.

export interface BannerTuning {
  /** The wash's center color. The ramp runs from here out to the page black. */
  glowColor: string;
  /** Mark pitch in CSS pixels. */
  spacing: number;
  /** Mark width in CSS pixels, tip to tip. */
  dotSize: number;
  /** The mark's flat color. */
  dotColor: string;
}

// The pitch and size are the Figma pattern's at 1x: marks 6.34 wide on a
// grid of about 20. The colors are read off the mock by eye.
export const BANNER_TUNING: BannerTuning = {
  glowColor: 'oklch(0.22 0.04 130)',
  spacing: 20,
  dotSize: 6.3,
  dotColor: 'oklch(0.38 0.02 155)',
};
