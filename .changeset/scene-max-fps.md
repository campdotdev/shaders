---
'@camp-dev/shaders': minor
---

`<ShaderScene>` takes a `maxFPS` prop, which sets the scene's frame cap, the most frames per second it draws. With no frame cap, a scene draws at the display's refresh rate, as before. `maxFPS={60}` draws every other frame of a 120 Hz display. A new value applies from the next frame without rebuilding the renderer. Frames that a prop change asks for count against the cap, but a resize still redraws at once. A frame cap never wakes a parked scene or resumes a paused one.

`FrameScheduler.setMaxFPS` sets the cap on a scheduler. The scheduler skips an animation frame that arrives sooner than one interval after its last tick, less a tenth of the interval for timestamp jitter. A tick's `delta` spans the skipped frames. Speed-driven animation keeps its pace while tick intervals stay at or below 0.1 seconds; longer intervals are clamped by `useAnimatableSpeed`, slowing the motion.
