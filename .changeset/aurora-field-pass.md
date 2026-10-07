---
'@camp-dev/shaders': minor
---

`Aurora` draws its field into a texture once per frame, and each march step reads the texture instead of working out five noise octaves, 60 times for every pixel. The texture stores the field before the shaping that makes the thin filaments, so the texture filter blends a smooth value and the filaments stay sharp. Pixel values shift slightly, but the curtains look the same. At 3272 by 1392 device pixels on an M1 Max, Aurora's GPU time per frame drops from about 14.4 ms to about 5.0 ms. Where the renderer cannot draw into a half-float target, on WebGL2 without `EXT_color_buffer_float`, Aurora works out the field at every step as before.

`ShaderContextValue` gains `registerPrePass`, which adds a draw that runs before the scene's meshes on every frame, including the redraw after a resize. A hand-built context, such as a fake one in a test, needs `registerPrePass` too, and `() => () => undefined` registers nothing. `ShaderMonitor`'s GPU time counts these draws along with the scene pass and the output quad.

`TexturePassOptions` gains `format`: `RGBAFormat`, the default, for four channels, or `RedFormat` for one.
