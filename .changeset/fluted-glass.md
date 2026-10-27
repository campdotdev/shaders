---
'@camp-dev/shaders': minor
---

Add `FlutedGlass`, an Effect that shows the image beneath it through repeating flutes of glass. Mount it after a Source inside a `ShaderScene`. Each flute bends the image under it into a squeezed copy. `fluteWidth` sets each flute's width in CSS pixels. `angle` sets the direction the flutes run, in the degrees `LinearGradient` uses, so the default of 90 gives vertical flutes. `refraction` sets how far the glass bends the image, and `refraction={0}` leaves it unchanged. `crossSection` sets each flute's shape, from a pointed `'prism'` through a `'round'` lens to a `'flat'` top with steep walls, or any number from 0 to 1 between them. Each of the four props takes a static value or an animation signal. Near the canvas edge, the glass mirrors the image back onto the canvas. `FlutedGlass` bends only what Sources drew, never the output of an Effect such as `Grain`, so mount such Effects after it. It works in Mode 1 only.

Add the `fluteSurface` primitive for Mode 2. For a position, it returns the bend to add before you sample your own texture, and the slope of the glass.
