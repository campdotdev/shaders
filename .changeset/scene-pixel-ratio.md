---
'@camp-dev/shaders': minor
---

`ShaderContextValue.canvasSize` holds `signal`, the scene's size signal that `useResize` returns, and `pixelRatio`, a float uniform with the renderer's device pixels per CSS pixel after any `maxDPR` cap. The scene creates `pixelRatio` once and writes it each time the canvas resizes, before it redraws. A component that sizes something in CSS pixels can read the one uniform, and `Dither`, `LedWall`, `Dissolve`, and `DotField` now do, with no change to how they look. A hand-built context, such as a fake one in a test, needs both fields.
