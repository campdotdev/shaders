---
'@camp-dev/shaders': minor
---

Add `scrollPush` to `ShaderScene`. With it on, a touch that scrolls the page over the canvas pushes the scene's cursor effects at the finger, and a fling keeps pushing until the page stops. The scene listens passively and never cancels a touch, so the page scrolls and zooms as it would without the scene. A touch then reaches cursor effects only this way, because touch pointer moves no longer move the cursor. A mouse works as before. `CursorRipple` stirs its water with the push.

`CursorInput` gains `setScrollPush`, `getPush`, `isPushing`, and `onPushStart`. The signal `useCursor` returns gains `getPush`, which reads the frame's push stroke. The new `PushStroke` type has the shape of a wave field's stroke. While `scrollPush` is on, `ShaderScene` ticks its shared `CursorInput` once per frame, ahead of the cursor effects that read it, and keeps drawing while a touch pushes.
