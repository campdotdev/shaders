---
'@camp-dev/shaders': minor
---

Add a `shape` prop to DotField. `'circle'` is the disk it has always drawn and `'cross'` is an x with flat-ended arms, sized by `dotSize` from tip to tip. The x is a new engine primitive, `signedDistanceFieldCross`, the union of two rectangles turned 45 degrees.

`shape` also takes a custom mark as inline SVG markup: `{ svg: '<svg viewBox="0 0 24 24">…</svg>' }`. The browser decodes the markup once into a 128px tile, and the shader reads the tile's alpha at each grid point, so any fill in the markup is ignored and the mark takes `color`. The `viewBox` scales to fit `dotSize` on its longer side. Custom cells draw nothing on the first frame and appear once the decode lands, while built-in marks draw at once. A non-square `viewBox` keeps its aspect and sits centered, and `width` and `height` stand in when there is no `viewBox`. Markup with no usable box, or that the browser cannot decode, warns once in the console and leaves its cells empty; nothing throws. The markup type is exported as `SvgMarkup`.

`shape` also takes a readonly array of marks, mixing built-in names and `{ svg }` objects freely. Each cell draws one entry, picked by a stable hash of its cell index, so the pick holds still from frame to frame and matches on WebGPU and on the WebGL2 fallback. A mark listed more than once is drawn that many times as often: `['cross', { svg: star }, { svg: star }]` draws about two stars per cross. Every custom entry in the array shares one padded texture, decoded once.
