---
'@camp-dev/shaders': minor
---

On WebGPU, a scene no longer keeps MSAA samples or a depth buffer. `createRenderer` defaults `antialias` to false and gives the canvas no depth buffer, and the scene pass inside `<ShaderScene>` renders without one. Every component draws one quad that covers the canvas and smooths its own edges, so neither changed a pixel. At 3272 by 1392 device pixels, a scene's render targets drop from about 400 MB to about 73 MB, and each resize reallocates the smaller set. The WebGL2 fallback renders as before.

If you call `createRenderer` yourself, pass `antialias: true` to turn MSAA back on. Nothing in a WebGPU scene is depth-tested, so each mesh you draw covers whatever three drew before it.
