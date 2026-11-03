# An Effect that changes only color registers as a resample when a UV warp mounted after it must move it

Status: Accepted. PaletteMap lands it in SHA-308.

An Effect changes the image beneath it in one of two ways. A color transform, such as Grain or Vignette, changes each pixel's color at the pixel's own position. A resample, as ADR 0004 defines it, builds each pixel from samples of the image beneath, at coordinates it chooses. The output stage runs every color transform after every resample, so a UV warp never moves what a color transform drew.

PaletteMap changes only color: it maps the image's lightness onto a few chosen colors, with a blue-noise dither at each band edge. Composition 2 (SHA-304) stacks it under LedWall, whose cell snap is a UV warp, and stacks a cursor heat field before it, so that the heat raises the field's value before the map. Every cell has to show exactly one palette color.

We chose to register PaletteMap as a resample that samples the image beneath once. Inside LedWall's snap it receives each cell's center as its coordinate, so it reads one lightness and one dither threshold per cell. The rule generalizes: an Effect that changes only color registers as a resample when a UV warp mounted after it has to move it with the image. An Effect that belongs to the screen rather than to the image, such as Grain or Vignette, stays a color transform.

## Considered options

- **PaletteMap as a color transform with a threshold read per cell.** For a Source alone this works. The snap gives every pixel in a cell the same input color, and a threshold read by cell index is the same across the cell. Rejected because a color transform works at each pixel's own position. The cursor heat would then be a color transform as well, its falloff would vary inside each cell, and a cell that a heat contour crosses would split into two colors.
- **A render target per Effect.** It would let any Effect read what the color transforms before it drew. ADR 0004 already leaves it as the later option, and nothing here changes that.

## Consequences

- CursorTrail (SHA-169) registers as a resample too. Mounted before PaletteMap, its sampler runs inside PaletteMap's, so the heat reaches the map as a value. A color-transform CursorTrail would run after every resample, after the map.
- A resample now reads what the Sources drew as changed by the resamples beneath it, not the Sources' image alone. ADR 0004's sampler chain already works this way. PaletteMap is the first resample whose change is visible to the ones above it.
- A color-only resample runs again for every sample that each resample above it takes. Under FlutedGlass it runs up to 36 times per pixel. Each PaletteMap run reads one texel of the blue-noise tile, converts one color to OKLab, and picks a palette color. Time a deep stack on WebGPU before you put a color-only resample under FlutedGlass in a composition.
- A color-only resample still can't see a color transform mounted before it. Grain mounted before PaletteMap runs after the map, and the map doesn't recolor the grain.
