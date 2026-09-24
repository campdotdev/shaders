---
'@camp-dev/shaders': minor
---

Remove two APIs that only the node editor used. The package root no longer exports `colorSpaces`, the registry of color-space converters. To blend in a given space, pass `colorSpace` to `mixColor` or `colorRamp`. `ColorRampStop.position` now takes a number and rejects a TSL node, so moving a stop rebuilds the material. Ramps with literal positions, which covers every component, compile the same shader as before.
