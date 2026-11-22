---
'@camp-dev/shaders': minor
---

Add `HeatShimmer`, an Effect that wavers the image beneath it, the way hot air does. Mount it after the Sources it should act on inside a `ShaderScene`. Small lumps of shift rise up the canvas and change shape as they go, and the image beneath wavers with them. With no props the whole image wavers. Its props:

- `strength` sets how hard the shimmer pushes, from 0 to 1. 1 is the most that can't fold the image, and `strength={0}` leaves the image unchanged.
- `scale` sets how many lumps fit in the canvas's height. Higher is more and smaller, as on `FractalNoise` and `SimplexNoise`, and a change of scale keeps the look's strength.
- `speed` multiplies the shimmer's pace. A negative speed makes the shimmer sink, and `speed={0}` holds it still as a fixed warp.
- `band` confines the shimmer to a horizontal band with soft edges.
- `bandPosition` sets the band's middle, from 0 at the top of the canvas to 1 at the bottom. Its JSDoc gives the formula that puts the band on `Swells`' horizon.
- `bandHeight` sets the band's full height, as a share of the canvas's height.
- `bandFeather` sets the share of the band, from each edge inward, that fades. `bandFeather={0}` gives hard edges.

Every prop except `band` takes a static value or an animation signal, and no prop change rebuilds the shader. `HeatShimmer` bends only what Sources drew, so an Effect such as `Grain` stays still whether you mount it before or after the shimmer. Over a flat color it shows nothing. `bandPosition` takes a number, not `'cursor'`. The shimmer slows under reduced motion, and a scene of still Sources stops drawing when `strength` or `speed` is 0. It works in Mode 1 only.
