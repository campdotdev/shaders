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
A component prop that names a point on the canvas. A component's own center is `center`; a point that belongs to one reaction among the component's other dials is named after the reaction, such as `swellCenter`. It is a position, not a cursor: the cursor is one Input you can feed it. The `'cursor'` shorthand expresses that mapping without a hook, as in `swellCenter="cursor"`.
_Avoid_: Cursor prop, interactive prop, entry point, focus

**Reaction**:
A component's response that grows toward a point and needs the component's own internals, such as LedWall's swell. A reaction exposes three props: the amount named for the reaction, where 0 turns it off, a `<reaction>Radius` in canvas units, and a `<reaction>Center` position prop.
_Avoid_: Interaction, cursor ability, hover effect

**Cursor effect**:
An Effect driven by the cursor Input that works over any scene with no help from the components beneath it. CursorSpotlight and CursorRipple are two.
_Avoid_: Interactive shader, cursor component, drop-in

### Rendering

**Render on demand**:
A scene draws every frame until its components' idle votes let it park. A parked scene does no GPU work. An Input or a prop change asks for frames only until its value settles, and the scene stays parked. An animated vote restarts the frame loop.
_Avoid_: Idle mode, frameloop demand, static scene

**Idle vote**:
A component's say in whether its scene may park. A component votes idle while nothing it draws can change, votes animated while anything can, or casts no vote; a scene parks only when at least one component votes idle and none votes animated.
_Avoid_: Static hint, render-on-demand vote, static vote

**Frame cap**:
The most frames per second a scene draws, set by its app. With no frame cap, a scene draws at the display's refresh rate, so a 120 Hz display gets 120 frames a second. Frames a prop change asks for count against the frame cap. A frame cap never wakes a parked scene or resumes a paused one.
_Avoid_: Frame budget, target frame rate, fps limit

**Paused scene**:
A scene frozen on its current frame, by its app through `paused`, or because the tab is hidden or the canvas is off screen. Time stops while a scene is paused, so it resumes on the frame it stopped on. A parked scene stops drawing because nothing it draws can change. A paused scene stops whatever its components vote.
_Avoid_: Frozen scene, stopped scene

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

**Demo**:
The live scene and its control panel at the top of a component page. The homepage hero turns into Aurora's demo as the page scrolls.
_Avoid_: Editor, playground

**Favorite**:
A component hand-picked for the homepage's favorites grid. It links to its component page.
_Avoid_: Featured component, highlight

**Card tab**:
The strip that cuts into a favorite's edge to show the favorite's short name, such as "Simplex" for Simplex Noise, when the card is hovered or focused.
_Avoid_: Tab, name tab, label tab

**Feature card**:
A card in the homepage's features section that illustrates one quality of the library, such as "Composable" or "Reactive". Unlike a favorite, a feature card shows no component.
_Avoid_: Benefit card, value prop, pillar, featured card

**Story**:
The animation a feature card plays when the pointer moves over it. Once started, a story always finishes, and the card returns to its still frame.
_Avoid_: Intro, entrance, demo, hover effect

**Still frame**:
The one frame a feature card shows whenever its story is not playing. It need not be the story's first or last frame.
_Avoid_: End frame, rest state, poster
