---
'@camp-dev/shaders': minor
---

Add `Swells`, a Source that draws a rolling surface through a camera of its own, from round swells like silk or open water to sharp, wind-shaped dunes. Each pixel casts a ray from the camera, follows it to the surface, and shades the surface by how squarely it faces a light. With distance, the surface turns to a haze color and then fades out. Swells draws no sky: above the horizon it is transparent, so the page shows through, or a sky Source mounted beneath it inside the `ShaderScene` does. Its numeric props each take a static value or an animation signal:

- `altitude`: how high the camera sits above the ground, in terrain units.
- `tilt`: how far the camera looks down from the horizon, in degrees.
- `fieldOfView`: how much the camera sees from the bottom of the canvas to the top, in degrees.
- `scale`: how many swells, crest to crest, fit in 10 terrain units.
- `relief`: how tall the swells are, in terrain units. 0 gives level ground. Short swells stop growing taller once their faces get too steep for the ray to follow.
- `sharpness`: the swells' shape, from 0 for round swells to 1 for sharp dune crests.
- `angle`: which way the swells face, in compass degrees clockwise from the way the camera faces. The crests run square to it.
- `ripples`: how strong the fine ripples are, from 0 to 1. 0 gives a smooth surface.
- `lightAngle`: where the light sits, in compass degrees clockwise from the way the camera faces.
- `lightHeight`: how high the light sits, in degrees above the horizon.
- `sheen`: how strong the soft highlight is where the surface mirrors the light, from 0 for a matte surface to 1.
- `haze`: how thick the haze is, per terrain unit. 0 is clear air.
- `speed`: how fast the camera glides forward, in terrain units per second. Negative glides backward, and the glide slows under reduced motion.
- `swellSpeed`: how fast the swells rise and fall in place. 0 holds every swell at its height.
- `parallax`: how far the camera sways sideways toward `parallaxCenter`, in terrain units. The sway holds at 0 under reduced motion.

`color` and `shadowColor` set the surface's color in full light and on the faces turned from it. `sheenColor` is the highlight's color, and `hazeColor` is the color the far surface turns to. Every blend between them runs in `colorSpace`, which defaults to `oklab`, along the hue arc `hueInterpolation` picks.

`parallaxCenter` is the point the camera sways toward. Pass `"cursor"` to follow the pointer. With `intro`, on by default, the surface rises from flat ground as the scene first draws, once per mount. The intro skips to the finished surface under reduced motion and for posters.

Add two Tier 2 primitives for Mode 2, which Swells is built on:

- `cameraRay` returns the origin and direction of the ray from a perspective camera through a point on the canvas, for a camera's aspect, altitude, tilt, field of view, and turn.
- `marchHeightMap` follows a ray over a height function you write, in a fixed number of steps, and returns whether it hit the ground, how far along the ray, where, and the ground's normal there.
