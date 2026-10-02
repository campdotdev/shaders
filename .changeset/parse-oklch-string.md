---
'@camp-dev/shaders': minor
---

`@camp-dev/shaders/color` exports `parseOklchString`, which reads an `oklch()` string into its lightness, chroma, and hue numbers without converting them. It accepts the same syntax as `parseColorString`. A color picker can set its sliders from a typed value with it, where a round trip through linear-sRGB would drift the last decimal place. The root entry exports it too.
