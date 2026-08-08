---
'@lovo/matter-cli': minor
---

Add `repeat` to LinearGradient: how many times the stops run across the gradient's span. The default of 1 keeps the existing single pass; above 1 the pattern tiles past both ends, so stripes run edge to edge at any angle. Each pass snaps back to the first stop, so match your first and last stops unless you want a visible edge at every stripe boundary. `speed` changes character with it: a single pass keeps the existing back-and-forth drift, while repeated stripes march steadily in the angle's direction. Values at or below 1 render as a single pass. Accepts a static value or an animation signal.
