---
'@lovo/matter': minor
---

Add ditherThreshold, a single entry point for ordered-dither threshold maps: Bayer 2x2/4x4/8x8, halftone dots and lines, white noise, interleaved gradient noise, and a precomputed 64x64 blue-noise tile. The anti-banding dither() now builds on it. quantize() accepts a node for its step count (so a level count can ride a uniform) and an optional threshold argument that replaces the 0.5 rounding point. Passing a threshold map there turns a plain posterize into ordered dithering, which is how the Dither registry component uses the pair.
