---
"@lovo/matter": minor
---

Add `filmGrain` primitive — hash-based, centered film grain for shader compositions.

```ts
import { filmGrain, time } from '@lovo/matter'
import { uv } from 'three/tsl'

// Static grain:
const grain = filmGrain(uv(), 0.08)

// Twinkling grain — caller controls the shutter rate. floor() quantizes
// time to a discrete cadence; the hash is so sensitive that a continuous
// time input gives no perceptible speed control.
const grain = filmGrain(uv(), 0.08, time.mul(speed).mul(60).floor())

material.colorNode = vec4(color.add(grain), 1)
```

Output is centered around zero (mean of `length(vec2(u, v))` for uniform
`u, v ∈ [0, 1)` is ~0.765, subtracted at the recipe level) so the grain
acts as a brightness-preserving texture overlay. Subtract instead of add
at the call site for film-stock-style darkening.
