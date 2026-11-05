---
'@camp-dev/shaders': minor
---

Add `CursorTrail`, a cursor effect that lights a trail behind the pointer. Mount it after a Source inside a `ShaderScene`. The trail is widest at the pointer and tapers to a point along the path behind it. When the pointer stops, the trail draws in along its path. It adds light to the image beneath it rather than scaling its color, so an Effect mounted after it, such as `PaletteMap`, maps the trail with the image. Its props:

- `radius` sets the brush radius in canvas heights. It defaults to 0.1.
- `intensity` sets the light added at full heat, in linear color. It defaults to 0.5.
- `decay` sets the seconds a stopped pointer's trail takes to draw in. A moving pointer trails about as far as it travels in that time. It defaults to 0.75.
- `grow` widens the whole trail with the pointer's speed, as a share of `radius`, and eases it back as the pointer slows. It defaults to 0.3, and `grow={0}` keeps one size at every speed.
- `smoothing` averages the path behind the pointer over that distance in canvas heights, so the trail follows a smoother curve than the pointer took. The head stays on the pointer. It defaults to 0.05.
- `hold` keeps a steady spot under a still pointer until the pointer leaves the canvas. It defaults to `false`.

Every prop except `hold` takes a static value or an animation signal. `intensity={0}` or `radius={0}` turns the effect off. Under the `paused` motion policy, the trail is off, and only a held spot shows. It works in Mode 1 only.
