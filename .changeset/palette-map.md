---
'@camp-dev/shaders': minor
---

Add `PaletteMap`, an Effect that repaints the image beneath it in a few chosen colors, picked by lightness. Mount it after a Source inside a `ShaderScene`. The darkest areas take the first color and the lightest take the last, with the rest spaced evenly between. Where two colors meet, single cells of each scatter into the other through a blue-noise dither, so no band edge is a clean line. Its props:

- `colors` is the palette, darkest input first, as 2 or more hex, `oklch()`, or `oklab()` strings.
- `pixelSize` sets the edge of one cell in CSS pixels. Each cell takes one color.
- `spread` sets how far the colors scatter into each other: 0 draws clean edges, 1 mixes them across the whole step between two colors, and above 1 scatters stray cells into flat areas too. It defaults to 0.5.

`pixelSize` and `spread` take a static value or an animation signal. To give each dot of an `LedWall` one color, mount `PaletteMap` before the wall and set `pixelSize` to the wall's `spacing`. `PaletteMap` doesn't recolor Effects that change color in place, such as `Grain`. They always run after it, so mount them after it. It works in Mode 1 only.
