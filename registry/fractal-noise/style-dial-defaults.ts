// Per-style defaults for the two dials whose best values follow the texture
// character: contrast and balance. Lives in its own module — with no runtime
// imports — so UI code (a controls panel, the docs demo) can read these
// numbers without pulling the shader, and three, into its bundle.
import type { FractalNoiseStyle } from './shader';

// Clouds and smoke read best anchored near the ramp midpoint with contrast
// pushing toward the extremes; veins reads best as a pale field with soft
// veining, which means low contrast and a high balance that parks the field
// in the ramp's bright end. Explicit props always win.
export const STYLE_DIAL_DEFAULTS: Record<FractalNoiseStyle, { contrast: number; balance: number }> =
  {
    clouds: { contrast: 1.75, balance: 0.52 },
    smoke: { contrast: 1.75, balance: 0.52 },
    veins: { contrast: 1, balance: 0.8 },
  };
