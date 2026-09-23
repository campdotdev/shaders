# Shaders

A React shader component library on WebGPU and Three.js TSL. This glossary holds the terms the project uses for its own concepts, so code, docs, and issues say the same thing.

## Language

### Scene model

**Source**:
A component that draws its own image into a scene, such as MeshGradient or DotField. It is the thing an Effect acts on.
_Avoid_: Base component, generator, layer

**Effect**:
A component that acts on the image beneath it in a scene rather than drawing its own, such as Grain, Dither, or LedWall. An Effect composes over any Source or Effect mounted before it.
_Avoid_: Overlay, post-process pass, post-process layer, filter

**Input**:
A value that changes over time and is not drawn, such as the cursor, scroll, or canvas size. An Input is fed to a component as an animation signal.
_Avoid_: Cursor hook, entry point, scene-level field

**Position prop**:
A component prop that names a point on the canvas. A component's own center is `center`; a point that belongs to one reaction among the component's other dials is named after the reaction, such as `swellCenter`. It is a position, not a cursor: the cursor is one Input you can feed it. The planned `'cursor'` shorthand will express that mapping without a hook.
_Avoid_: Cursor prop, interactive prop, entry point, focus

**Reaction**:
A component's response that grows toward a point and needs the component's own internals, such as LedWall's swell. The planned reaction API exposes three props: the amount named for the reaction, where 0 turns it off, a `<reaction>Radius` in canvas units, and a `<reaction>Center` position prop.
_Avoid_: Interaction, cursor ability, hover effect

**Cursor effect**:
An Effect driven by the cursor Input that works over any scene with no help from the components beneath it. CursorRipple is one. CursorSpotlight is planned.
_Avoid_: Interactive shader, cursor component, drop-in

### Pattern components

**Mark**:
The single figure drawn at each grid point of a pattern component such as DotField. Every mark is a coverage at a cell-local point, computed from a signed distance for a built-in mark or read from a decoded tile for a custom mark, so sizing and ripple displacement work the same for every mark.
_Avoid_: Glyph, symbol, icon, dot (except inside shipped identifiers such as `DotField` and `dotSize`)

**Built-in mark**:
A mark the library ships by name, such as the circle and the cross. Its edge is an exact distance, so it stays crisp at any size.
_Avoid_: Preset shape, default shape

**Custom mark**:
A mark the caller supplies as inline SVG markup. Only its coverage is read, so it takes the field's color like any other mark.
_Avoid_: Custom shape, user shape, icon

### Docs site

**Search trigger**:
The button in the site header that opens the search panel and focuses its input. It is not an input itself.
_Avoid_: Search bar, search box, search input (for the header control)

**Search panel**:
The dialog the search trigger opens, holding the query input and the result list over the blurred page.
_Avoid_: Search modal, search dialog, command palette
