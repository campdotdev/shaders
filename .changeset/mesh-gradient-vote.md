---
'@camp-dev/shaders': patch
---

`MeshGradient` now tells the scene it is animating. It cast no vote before, so any component in the same scene that voted static, such as `CursorRipple`, `Dissolve`, or a `LinearGradient` at speed 0, let the scene stop drawing and froze the gradient until the next pointer move or prop change.
