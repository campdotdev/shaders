---
'@camp-dev/shaders': minor
---

`<ShaderScene>` takes a `paused` prop, which freezes the scene on its current frame. Time stops while the scene is paused, so it resumes on the frame it stopped on. While paused, a resize draws the frozen frame again at the new size. A scene paused from its mount draws nothing until it resumes.

Paused time no longer counts anywhere. When a scene resumes after a hidden tab or an off-screen canvas, it now carries on from its last frame rather than jumping ahead by the time away. `FrameScheduler`'s first tick after a resume carries no `delta`, and `elapsed` counts only the time the scheduler ran. `FrameScheduler.onPauseChange` tells a listener when the scheduler pauses or resumes. `holdRendererClock` holds the renderer's clock at its current time and returns the function that puts it back, because three's own animation loop advances that clock on every animation frame, rendered or not. The pause watcher's `setPaused` pauses the loop whatever the visibility.
