---
'@camp-dev/shaders': patch
---

A running `<ShaderScene>` now redraws straight after its canvas resizes. A resize clears the canvas after the frame loop has drawn, so while a canvas changed size on every frame, such as during a window drag, the browser painted a cleared canvas on almost every frame. The redraw ticks no animation, so a `speed` phase still advances once per frame. A scene out of view, or in a hidden tab, skips the redraw and draws at the new size when it resumes.

The scene now updates `useResize`'s size before it redraws, so the redrawn frame has the new aspect ratio. `useResize` returns the scene's size signal from its first render, where it used to return a placeholder size of `[0, 0, 1]` for one render. Every `useResize` call in a scene shares that one signal, in place of a resize observer each.
