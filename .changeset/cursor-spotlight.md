---
'@camp-dev/shaders': minor
---

Add `CursorSpotlight`, which brightens the scene around the pointer. Mount it inside a `ShaderScene` after the components it should light. It takes two props, each a static value or an animation signal: `radius` sets the light's reach in canvas heights, and `intensity` sets how much brighter the image gets under the pointer, where 1 doubles it. The light scales existing color, so black stays black. It is invisible until the first pointer move, fades out when the pointer leaves the canvas, and lets the scene idle while the pointer is still. It works in Mode 1 only.
