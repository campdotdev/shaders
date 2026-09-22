---
'@camp-dev/shaders': minor
---

Every `useCursor()` call inside a `ShaderScene` now reads one shared pointer input owned by the scene, created on the first call and disposed with the scene, and smooths toward it at its own `smoothing`. The signal gains `presence`, a 0..1 signal that eases to 1 after the pointer enters the canvas and to 0 after it leaves, for effects to multiply their strength by. `useCursor({ enabled: false })` attaches nothing and returns a fixed signal, and `useCursor({ element })` keeps a private input in the caller's frame. `CursorInput` listens for `pointermove` rather than `mousemove`, so touch and pen drive it, and exposes the raw target through `getTarget()`, the inside state through `isInside()`, and move subscriptions through `onMove()`. The `onMove` constructor option, added in the previous unreleased change, moves to the hook.
