---
'@camp-dev/shaders': minor
---

The hooks an Effect uses to change the image beneath it now take the glossary's names. `useUvWarp` registers a UV warp, a function of type `UvWarp`, and `useColorTransform` registers a color transform, a function of type `ColorTransform`. Each hook takes the same function and deps as before and behaves the same. `ShaderContextValue` registers them through `registerUvWarp` and `registerColorTransform`, and `OutputStage` through `registerUvWarp`, `registerColorTransform`, and `hasColorTransforms`. The old names are gone, with no aliases. To migrate, rename `useBasePassUv` to `useUvWarp`, `UvTransform` to `UvWarp`, `usePostProcessPass` to `useColorTransform`, `PostProcessTransform` to `ColorTransform`, `registerBaseUvTransform` to `registerUvWarp`, `registerOverlay` to `registerColorTransform`, and `hasOverlays` to `hasColorTransforms`.
