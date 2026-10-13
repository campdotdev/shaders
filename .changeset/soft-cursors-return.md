---
'@camp-dev/shaders': minor
---

Add `CursorSmudge`, a cursor effect that pulls the Sources' image along pointer movement and recovers smoothly. Control the pull with `strength`, `radius`, and `decay`, using numbers or animation signals. Set `decay={0}` to hold the distortion. Enable `scrollPush` on `ShaderScene` for touch scrolling.
