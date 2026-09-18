# Custom DotField marks are SVG markup, not TSL distance functions

DotField draws every mark as a signed distance field, and SHA-145 laid out two routes to custom marks: a TSL function `(point, halfSize) => distance`, or inline SVG markup rasterized to a texture. We chose SVG. A mark is then data: a designer can draw it, it serializes into presets, JSON, and Copy React output, and an editor can take it as a text param later. A TSL function is code, needs distance-field math to author, and cannot travel through any of those. Performance did not decide it, since a texture fetch and a few arithmetic ops are both invisible on a background grid.

## Consequences

- The two built-in marks, circle and cross, stay as distance functions, so they are crisp at any size. Custom marks are decoded once into fixed-size tiles and soften past that size.
- Custom marks paint one decode later than the built-ins, so a field with SVG marks pops in. The poster covers the gap.
- Only a custom mark's alpha is read. Its fills are ignored, and every mark takes the field's `color`.
- A React-element form is additive later as an adapter in the React layer that reduces the element to markup, so the engine still only sees strings.
