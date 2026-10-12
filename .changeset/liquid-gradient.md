---
'@camp-dev/shaders': minor
---

Add `LiquidGradient`, a Source that streaks bands of color along slow, curling currents, like paint stirred into liquid. Mount it inside a `ShaderScene`. `stops`, `colorSpace`, and `hueInterpolation` pick the colors, as they do on `LinearGradient`. `angle` and `repeat` lay the bands out before the current moves them, and `softness` sets how the colors meet, from hard bands at 0 to full blends at 1. `swirl` sets how far the current carries the colors, `scale` sets roughly how many eddies span the canvas's height, and `speed` sets how fast the current drifts. Each of those six props takes a static value or an animation signal. `seed` picks a different layout with the same look. A literal `speed={0}` holds the current still and lets the scene park. It works in Mode 1 only.

`LiquidGradient` draws the current, a noise field, and its palette into textures before the scene pass, and redraws each texture only when a prop it depends on changes. Where the renderer cannot draw into a half-float target, on WebGL2 without `EXT_color_buffer_float`, every read works its value out from the noise or the palette instead. The result looks the same and costs more GPU time.
