---
'@camp-dev/shaders': minor
---

Add `Swells`, a Source that draws wind-shaped sand dunes through a camera of its own. Each pixel casts a ray from the camera, follows it to the sand, and lights the sand from a sun. Swells draws only the ground and is transparent where the ray misses it, so mount a sky Source, such as a `LinearGradient`, beneath it inside a `ShaderScene`. Its numeric props each take a static value or an animation signal:

- `altitude`: how high the camera sits above the ground, in terrain units.
- `tilt`: how far the camera looks down from the horizon, in degrees.
- `fieldOfView`: how much the camera sees from the bottom of the canvas to the top, in degrees.
- `scale`: how many dunes, crest to crest, fit in 10 terrain units.
- `relief`: how tall the dunes are, in terrain units. 0 gives level ground.
- `ripples`: how strong the wind ripples are, from 0 to 1. 0 gives smooth sand.
- `sunAngle`: where the sun sits, in compass degrees clockwise from the way the camera faces.
- `sunHeight`: how high the sun sits, in degrees above the horizon.

`color` and `shadowColor` set the sand's color in full sun and on the faces turned from it. The slopes between blend the two in `colorSpace`, which defaults to `oklab`, along the hue arc `hueInterpolation` picks.

Add two Tier 2 primitives for Mode 2, which Swells is built on:

- `cameraRay` returns the origin and direction of the ray from a perspective camera through a point on the canvas, for a camera's aspect, altitude, tilt, field of view, and turn.
- `marchHeightMap` follows a ray over a height function you write, in a fixed number of steps, and returns whether it hit the ground, how far along the ray, where, and the ground's normal there.
