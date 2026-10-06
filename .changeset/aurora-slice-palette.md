---
'@camp-dev/shaders': minor
---

Add `createTexturePass` and its `TexturePass` and `TexturePassOptions` types. A texture pass draws a TSL node into a render target of its own, and exposes the texture, `render`, `resize`, and `dispose`. It exposes no texture when the renderer cannot render to or bind the requested texel type: on WebGL2 without `EXT_color_buffer_float`, or for a full float on a WebGPU device without `float32-filterable`. After a lost device, it goes inert.

`Aurora` draws its 60 slice colors into a texture once per material build, instead of running its color ramp 60 times for every pixel. It also works out its per-pixel constants before its march loop. It looks the same as before. At 3272 by 1392 device pixels on an M1 Max, Aurora's GPU time per frame drops from about 18.4 ms to about 14.4 ms.
