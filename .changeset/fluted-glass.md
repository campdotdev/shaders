---
'@camp-dev/shaders': minor
---

Add `FlutedGlass`, an Effect that shows the image beneath it through repeating flutes of glass. Mount it after a Source inside a `ShaderScene`. Each flute bends the image under it into a squeezed copy, catches a highlight along the wall that faces the light, and darkens near its grooves where the glass turns steep. Its props:

- `fluteWidth` sets each flute's width in CSS pixels.
- `angle` sets the direction the flutes run, in the degrees `LinearGradient` uses, so the default of 90 gives vertical flutes.
- `refraction` sets how far the glass bends the image, and `refraction={0}` leaves it unchanged.
- `crossSection` sets each flute's shape, from a pointed `'prism'` through a `'round'` lens to a `'flat'` top with steep walls, or any number from 0 to 1 between them.
- `lightAngle` sets where the light comes from, in degrees that turn the same way as `angle`: 0 from the right and 90 from above. It defaults to 135, the upper left. The light stays put while `angle` turns the glass.
- `highlight` and `shadow` set how strong the highlight and the shadow are, from 0 to 1. `highlightColor` tints the highlight.

Every prop except `highlightColor` takes a static value or an animation signal. Near the canvas edge, the glass mirrors the image back onto the canvas. `FlutedGlass` bends only what Sources drew, never the output of an Effect such as `Grain`, so mount such Effects after it. It works in Mode 1 only.

Add the `fluteSurface` primitive for Mode 2. For a position, it returns the bend to add before you sample your own texture, the slope and steepness of the glass, and how far the position sits from its flute's center.
