---
'@camp-dev/shaders': minor
---

Add `FlutedGlass`, an Effect that shows the scene beneath it through a pane of ribbed glass. Mount it inside a `ShaderScene` after a Source. Each flute bends the image beneath it, catches a highlight from a fixed upper-left light, and darkens toward its seams. It takes nine props, each a static value or an animation signal: `width` sets a flute's width in CSS pixels, `angle` turns the flutes, `refraction` sets how far they bend the image, `softness` runs the profile from flat with sharp seams to a full half-cylinder, `shine` and `shadow` set the highlight and the seam shading, `sway` and `swayFrequency` bend each flute side to side, and `speed` drifts the flutes sideways and moves the sway along them. At `refraction={0}`, `shine={0}`, and `shadow={0}`, the image passes through unchanged. At the default `speed={0}`, the scene can idle. It works in Mode 1 only, and it bends only what the Sources drew, so mount other Effects, such as `Grain`, after it.
