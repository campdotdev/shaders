---
'@camp-dev/shaders': minor
---

Add `Bloom`, an Effect that spills light from the bright parts of the image beneath it. Mount it after the Sources it should act on inside a `ShaderScene`. Whatever is brighter than a threshold glows: the glow is hot against the light and falls to a quarter each time the distance doubles. Its props:

- `strength` sets how much of the glow is added over the image. `strength={0}` leaves the image unchanged and skips the glow's GPU work, and values above 1 add more, so bright parts can clip to white.
- `radius` sets how far the glow reaches, from 0 to 1. At 1 it reaches about a third of the canvas's height. The glow stays as bright against the light at every radius, so a wider glow holds more light. The glow scales with the canvas and holds the same light at any pixel density.
- `threshold` sets how bright a part of the image has to be before it blooms, as a luminance. `threshold={0}` blooms everything. Light fades in from half the threshold up to it. A Source that adds light can pass 1, so values above 1 work.

Every prop takes a static value or an animation signal, and no prop change rebuilds the shader. `Bloom` reads the image through the same sampler every other Effect does, so a UV warp mounted before it shapes the glow. Where the glow lands on a transparent part of the scene, it shows over the page behind the canvas. A scene of still Sources under `Bloom` stops drawing. It works in Mode 1 only.
