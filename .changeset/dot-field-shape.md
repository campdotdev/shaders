---
'@camp-dev/shaders': minor
---

Add a `shape` prop to DotField. `'circle'` is the disk it has always drawn and `'cross'` is an x with flat-ended arms, sized by `dotSize` from tip to tip. The x is a new engine primitive, `signedDistanceFieldCross`, the union of two rectangles turned 45 degrees.
