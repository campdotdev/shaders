---
'@camp-dev/shaders': minor
---

`@camp-dev/shaders` now ships the components and the React binding too. It absorbs `@camp-dev/shaders-react` and the components that `shaders-cli add` used to copy into your project, so `Aurora`, `ShaderScene`, `useShaderMaterial`, and `fractalNoise` all import from the root:

```tsx
import { Aurora, ShaderScene } from '@camp-dev/shaders'
```

`@camp-dev/shaders/color` is unchanged. `@camp-dev/shaders-react/gamut` is now `@camp-dev/shaders/gamut`, and `@camp-dev/shaders-react/poster` is now `@camp-dev/shaders/poster`. Peer dependencies are `react ^19` and `three ^0.170`.

Components are no longer copied into your project. If you added one with `shaders-cli add`, delete the copied file and import the component from the package instead. The `shaders-cli` commands `init`, `add`, `list`, and `update` are retired in a following release; `poster` stays.
