---
'@camp-dev/shaders': minor
---

Add `strokeAt` to `ShaderScene`, so code can draw a scripted stroke across the scene's cursor effects. Pass an animation signal, such as a `MotionValue`, holding a point from 0 to 1 across the canvas. Each frame strokes from where the point was to where it is, and a move wakes a parked scene. Attaching the point, resuming from a pause, and resizing each start a fresh stroke. While a point is attached, `CursorSmudge` and `CursorRipple` ignore the mouse and scroll push. It works with or without `scrollPush`.

`CursorInput` gains `setStrokePoint`, `getScriptedStroke`, and `isScripting`, and the signal `useCursor` returns gains `getScriptedStroke` and `isScripting`. The new `StrokePoint` type is the shape a point must have.

`CursorInput` also gains `onPushEnd`, which fires once for every `onPushStart`, when the fling settles or the contact ends another way. A scripted stroke never starts or ends a push.
