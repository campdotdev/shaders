---
'@lovo/matter': minor
---

Add color-space-aware interpolation. `colorRamp` and the new `mixColor` primitive
accept `colorSpace` ('linear' | 'oklab' | 'oklch' | 'lch' | 'hsl' | 'hsv',
default 'oklab') and `hueInterpolation` ('shorter' | 'longer' | 'increasing' |
'decreasing', default 'shorter'). LinearGradient, SimplexNoise, and MeshGradient
gain matching props. Foundation fix: hex colors now decode to linear-sRGB (true
color), and the LCH conversion's green coefficient was corrected. This shifts the
default appearance of those components (pre-1.0 breaking color change).
