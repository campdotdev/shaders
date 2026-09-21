# Cursor reactions are Effects, and a position prop belongs on a component only when the reaction needs its internals

SHA-137 gave LedWall a cursor reaction, and SHA-138 asked whether every shader should grow its own cursor entry point or whether cursor reactions should be standalone components, the way other libraries ship `<CursorRipples>`. We chose the standalone form: a reaction that makes sense over any scene ships as a cursor effect on the output stage, such as CursorSpotlight and CursorRipple. A position prop belongs on a component only when the reaction needs that component's own internals, such as LedWall's dot positions or GodRays' ray sources, and cannot be done from outside. The prop is a position, never a cursor: it is named for what it is (`swellCenter`, `center`), and the cursor is one animation signal you can feed it.

Every position prop also accepts the string `'cursor'`, resolved in `useAnimatablePoint` to the scene's shared cursor, so `<LedWall swellCenter="cursor" />` needs no hook and no wrapper component. The shorthand is still explicit in the JSX, which is the property the ambient option below lacks.

## Considered options

- **An ambient scene-level cursor** that any component with an unset position prop reads implicitly. Rejected: a static-looking component would turn interactive because of a sibling, the idle vote gets murkier, and it does nothing for Mode 2. The animation signal protocol already covers the explicit case in one line, `focus={useCursor()}`.
- **A cursor prop on every component.** Rejected: each shader would carry its own reaction code for something a single Effect can do over any scene, and LedWall's brighten was already moved out for exactly that reason.

## Consequences

- LedWall keeps its swell, because it needs dot positions, and its props are renamed to `swellCenter`, `swellRadius`, and `swell` so the point is named for its reaction. Its brighten is CursorSpotlight's job.
- A component's own center stays `center`. A point that belongs to one reaction among other dials is `<reaction>Center`.
- A new component that wants a cursor reaction first asks whether an Effect can do it from outside. Only when the answer is no does it take a position prop.
- Cursor effects need the scene's output stage, so they are Mode 1 only. Mode 2 gets the TSL primitives and `useCursor`.
