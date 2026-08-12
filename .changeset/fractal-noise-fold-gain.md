---
'@lovo/matter': minor
---

Widen `fractalNoise` with turbulence folding and live gain: a new `fold` option ('none' | 'smooth' | 'sharp') folds each octave with abs() before summing — squared for soft billows, square-rooted for crisp veins — and `gain` now also accepts a TSL node, computing per-octave amplitude as pow(gain, i) on the GPU so a uniform-driven detail dial glides without rebuilding the material. Folded output is normalized to roughly 0..1 (unfolded stays roughly -1..1).
