---
'@camp-dev/shaders': minor
---

Every position prop now accepts `"cursor"`, which follows the pointer through the scene's shared cursor with no hook call and no wrapper component, so `<LedWall swellCenter="cursor" />` swells under the pointer on its own. A fixed point or an animation signal still works, and a fixed point attaches no pointer listener. The props share a new exported `PositionProp` type, and `useAnimatablePoint` takes a `cursorInitial` option for where a `"cursor"` point sits before the first move. LedWall's point is renamed after its reaction, with defaults unchanged. To migrate, rename `focus` to `swellCenter` and `focusRadius` to `swellRadius`. Blobs' `center` now measures y from the top, like every other mesh component's position prop, so a `"cursor"` center moves the right way. The default `[0.5, 0.5]` renders the same. A custom center with y other than 0.5 mirrors vertically, so replace y with `1 - y` to keep the old placement.
