---
'@camp-dev/shaders': minor
---

Add `Swells`, a Source that draws a rolling surface through a camera of its own, from round swells like silk or open water to sharp, wind-shaped dunes. Each pixel casts a ray from the camera, follows it to the surface, and lights the surface from a sun. With distance, the surface turns to a haze color and then fades out. Swells draws no sky: above the horizon it is transparent, so the page shows through, or a sky Source mounted beneath it inside the `ShaderScene` does. Its numeric props each take a static value or an animation signal:

- `altitude`: how high the camera sits above the ground, in terrain units.
- `tilt`: how far the camera looks down from the horizon, in degrees.
- `fieldOfView`: how much the camera sees from the bottom of the canvas to the top, in degrees.
- `scale`: how many swells, crest to crest, fit in 10 terrain units.
- `relief`: how tall the swells are, in terrain units. 0 gives level ground. Short swells stop growing taller once their faces get too steep for the ray to follow.
- `sharpness`: the swells' shape, from 0 for round swells to 1 for sharp dune crests.
- `ripples`: how strong the fine ripples are, from 0 to 1. 0 gives a smooth surface.
- `sunAngle`: where the sun sits, in compass degrees clockwise from the way the camera faces.
- `sunHeight`: how high the sun sits, in degrees above the horizon.
- `sheen`: how strong the soft highlight is where the surface mirrors the sun, from 0 for a matte surface to 1.
- `haze`: how thick the haze is, per terrain unit. 0 is clear air.
- `mirage`: how strongly the far surface shimmers, from 0 to 1, like heat haze over sand. While it is above 0, Swells keeps the scene drawing every frame. The shimmer slows under reduced motion.

`color` and `shadowColor` set the surface's color in full sun and on the faces turned from it. `sheenColor` is the highlight's color, and `hazeColor` is the color the far surface turns to. Every blend between them runs in `colorSpace`, which defaults to `oklab`, along the hue arc `hueInterpolation` picks.

Add two Tier 2 primitives for Mode 2, which Swells is built on:

- `cameraRay` returns the origin and direction of the ray from a perspective camera through a point on the canvas, for a camera's aspect, altitude, tilt, field of view, and turn.
- `marchHeightMap` follows a ray over a height function you write, in a fixed number of steps, and returns whether it hit the ground, how far along the ray, where, and the ground's normal there.
