---
'@lovo/matter': minor
---

Widen `fractalNoise` with turbulence folding and live gain: a new `fold` option ('none' | 'smooth' | 'sharp') — 'smooth' and 'sharp' fold each octave with abs() before summing, squared for soft billows or square-rooted for crisp veins, while 'none' keeps the raw signed noise — and `gain` now also accepts a TSL node, computing per-octave amplitude as pow(gain, i) on the GPU so a uniform-driven detail dial glides without rebuilding the material. Folded output is normalized to roughly 0..1 ('none' stays roughly -1..1).
