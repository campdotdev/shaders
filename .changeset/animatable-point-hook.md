---
'@lovo/matter-react': minor
---

Add `useAnimatablePoint`, a vec2 counterpart to `useAnimatableUniform`: pass it an `[x, y]` pair or an animation signal and it keeps a point uniform current. `center` now accepts a signal on LinearGradient, RadialGradient, DotField, and Vignette. LinearGradient's `angle` animates now too. Its direction vector used to be precomputed on the CPU inside an effect, so a signal had nothing to reach; the shader now derives the direction from a scalar angle uniform. Also fixed: DotField and Vignette skipped the render request when `center` changed, so dragging it on an idle scene (speed 0) changed nothing until something else forced a frame.
