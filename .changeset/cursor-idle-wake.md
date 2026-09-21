---
'@camp-dev/shaders': minor
---

A scene whose only live input is the cursor now idles while the pointer is still. `useCursor` asks the scene's scheduler for a frame on each pointer move and on each tick that moves the smoothed position, so the scene draws in a short burst around pointer motion and then parks. LedWall's static vote no longer counts a cursor signal on `focus` as animated. `CursorInput` gains an `onMove` option, its `tick` now returns whether it notified listeners, the smoothing snaps onto the target once the gap is under a device pixel, and a tick longer than one 30fps frame is treated as one frame so the glide survives a wake.
