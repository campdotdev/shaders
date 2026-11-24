---
'@camp-dev/shaders': patch
---

`useShaderMaterial` now survives a Strict Mode remount. Before, the effect that disposed the material ran its cleanup while React kept the memoized material, so the hook returned a material it had already disposed. An `<Activity>` re-show took the same path. The hook now rebuilds the material when a remount finds it disposed, and still returns a usable material on the first render.
