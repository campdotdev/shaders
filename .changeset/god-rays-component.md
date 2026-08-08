---
'@lovo/matter-cli': minor
---

Add GodRays: soft rays of light streaming from an origin point, drawn as the product of two flowing noise fields so the beams flicker and drift instead of sweeping past like a rigid fan. Each color in `colors` (2 to 5) gets its own decorrelated ray layer, later colors finer-textured so they read as deeper planes, and the layers add their light over a transparent background, so stack the component above a dark layer in the scene. `center`, `angle`, `spread`, and `radius` aim and size the fan; the default parks the source just above the top edge with the cone wide open, so the frame does the cropping. `density` sets how many rays fit around a revolution, `diffusion` runs them from distinct beams to a soft wash, `patchiness` chops them into drifting dashes, and `glowRadius`/`glowIntensity` put a bright disc at the source. Every dial accepts an animation signal.
