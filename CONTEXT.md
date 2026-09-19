# Shaders

A React shader component library on WebGPU and Three.js TSL. This glossary holds the terms the project uses for its own concepts, so code, docs, and issues say the same thing.

## Language

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
