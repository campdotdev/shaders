---
'@lovo/matter': major
---

Rename the `filmGrain` primitive to `grain`.

The `filmGrain(intensity, timeOffset?)` primitive is now exported as `grain` with
an identical signature and behavior. The Tier 1 `<FilmGrain>` component (delivered
via the CLI) is likewise renamed to `<Grain>`, and its `film-grain` registry slug
is now `grain`.

**Migration:** one-pass find-and-replace.

```ts
// Before
import { filmGrain } from '@lovo/matter';
const g = filmGrain(0.08);

// After
import { grain } from '@lovo/matter';
const g = grain(0.08);
```
