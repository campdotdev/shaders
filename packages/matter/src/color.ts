// @mattermix/shaders/color — the CPU-only half of the color system, published as its
// own entry point. Everything here is plain scalar arithmetic with no path to
// three, which makes this module safe to import during a server render; the
// root entry is not, because its barrel reaches the renderer and three/webgpu
// reads `self` at module load. color.test.ts proves that property rather than
// trusting it. The root barrel re-exports all of these, so this is an
// additional door, not a replacement one.
//
// These imports go straight to the leaf modules (cpu-convert.js,
// cpu-transfer.js), not through `./primitives/color-space/index.js`. That
// barrel also re-exports `mixColor` from `mix-color.js`, which imports
// `three/tsl` — routing through it here would quietly drag three back into
// this three-free entry point. color.test.ts would catch the regression, but
// importing the leaves directly is what prevents it from being written.

export {
  linearSrgbToLinearDisplayP3,
  linearSrgbToOklch,
  oklabToLinearSrgb,
  oklchInGamut,
  oklchToGamut,
  oklchToLinearSrgb,
  parseColorString,
} from './primitives/color-space/cpu-convert.js';
export type { OutputGamut } from './primitives/color-space/cpu-convert.js';
export { linearChannelToSrgb, srgbChannelToLinear } from './primitives/color-space/cpu-transfer.js';
