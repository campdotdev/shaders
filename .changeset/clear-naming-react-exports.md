---
'@lovo/matter-react': minor
---

Rename ambiguous `@lovo/matter-react` public exports to clearer names (BREAKING, pre-1.0):

- `useOverlayPass` → `usePostProcessPass` (and the paired type `OverlayTransform` → `PostProcessTransform`)
- `useStaticHint` → `useStaticSceneHint`
- `MonitorAnchor` (type) → `ShaderMonitorAnchor`

Migration: update imports and call sites to the new names. Behavior is unchanged.
