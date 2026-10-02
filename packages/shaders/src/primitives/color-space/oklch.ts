// OKLch — OKLab's polar twin. Same space, different coordinates: instead of
// (a, b) axes it stores chroma (distance from gray — how colorful) and hue
// (the angle around the wheel). Converting is lab-polar.ts's
// rectangular<->polar math on top of oklab.ts. The payoff is in blending:
// mixing hue as an angle keeps colors saturated through the midpoint, where
// oklab's straight line can cut through gray — and the hue-arc choice
// becomes meaningful.
import { labToPolar, lerpHueLast, polarToLab } from './lab-polar.js';
import { linearToOklab, oklabToLinear } from './oklab.js';
import type { ColorSpaceImpl } from './types.js';

export const oklchSpace: ColorSpaceImpl = {
  fromLinear: (rgb) => labToPolar(linearToOklab(rgb)),
  toLinear: (lch) => oklabToLinear(polarToLab(lch)),
  lerp: lerpHueLast,
};
