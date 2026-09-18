---
'@camp-dev/shaders': minor
---

Add a `shape` prop to DotField. `'circle'` is the disk it has always drawn and `'cross'` is an x with flat-ended arms, sized by `dotSize` from tip to tip. The x is a new engine primitive, `signedDistanceFieldCross`, the union of two rectangles turned 45 degrees.

`shape` also takes a readonly array of marks. Each cell draws one entry, picked by a stable hash of its cell index, so the pick holds still from frame to frame and matches on WebGPU and on the WebGL2 fallback. A mark listed more than once is drawn that many times as often: `['circle', 'cross', 'cross']` draws about two crosses per circle.
