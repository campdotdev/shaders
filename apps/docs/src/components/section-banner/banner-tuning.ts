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

// The mock's pattern at 1x is five marks across 32 pixels, a 6.4 pitch, and
// its SVG export, which measures 6.34 wide on a grid of about 20, is that
// pattern at roughly 3x, so the marks are about 2 wide. The pitch is
// rounded to 6 so it is a whole number of device pixels at 1x and 2x, which
// puts every mark at the same sub-pixel position and so draws every mark
// the same, and the size is nudged up so the arms are at least one device
// pixel thick on a 2x display. The colors are read off the mock by eye.
export const BANNER_TUNING: BannerTuning = {
  glowColor: 'oklch(0.22 0.04 130)',
  spacing: 6,
  dotSize: 2.5,
  dotColor: 'oklch(0.26 0.02 155)',
};
