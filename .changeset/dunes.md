---
'@camp-dev/shaders': minor
---

Add `Dunes`, a Source that draws terrain through a camera of its own. Each pixel casts a ray from the camera, follows it to the ground, and lights the ground from its slope. Dunes draws only the ground and is transparent where the ray misses it, so mount a sky Source, such as a `LinearGradient`, beneath it inside a `ShaderScene`. Its props, each a static value or an animation signal:

- `altitude`: how high the camera sits above the ground, in terrain units.
- `tilt`: how far the camera looks down from the horizon, in degrees.
- `fieldOfView`: how much the camera sees from the bottom of the canvas to the top, in degrees.

Add two Tier 2 primitives for Mode 2, which Dunes is built on:

- `cameraRay` returns the origin and direction of the ray from a perspective camera through a point on the canvas, for a camera's aspect, altitude, tilt, field of view, and turn.
- `marchHeightMap` follows a ray over a height function you write, in a fixed number of steps, and returns whether it hit the ground, how far along the ray, where, and the ground's normal there.
