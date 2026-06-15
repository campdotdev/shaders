---
"@lovo/matter": minor
---

Rename engine exports to spelled-out, domain-accurate names (breaking).

- `fbm` → `fractalNoise` (and `FBMOptions` → `FractalNoiseOptions`)
- `noise` → `simplexNoise`
- `sdfCircle` → `signedDistanceFieldCircle`
- `time` → `elapsedTime`
- `Vec2` → `Vector2`

`TSLNode`, `voronoi`, `colorRamp`, `quantize`, `displace`, `cursorRipple`, and `filmGrain` are unchanged.

**Migration:** one-pass find-and-replace in your imports and call sites. No behavioral changes.
