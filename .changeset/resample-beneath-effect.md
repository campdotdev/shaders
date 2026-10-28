---
'@camp-dev/shaders': minor
---

An Effect can now take more than one sample of the image beneath it. `useResample` registers a resample, a function that receives the sampler for everything mounted beneath the Effect and returns the sampler that replaces it. The new sampler can call the one beneath as often as it needs, such as three times for a color split. The `Resample` and `Sampler` types describe the two functions. `useBasePassUv` keeps its signature and registers the resample that samples beneath once, at the warped coordinate. `Dither`, `LedWall`, `CursorRipple`, `CursorSmudge`, and `FlutedGlass` draw the same as before unless two of them stack.

When two UV warps stack, the last-mounted one is now the top layer, the way every other Effect stacks. Before, the first-mounted UV warp moved the screen coordinate first, so `<Dither /><CursorRipple />` pixelated the water along with the image beneath it. Now Dither pixelates the image, and the water bends the pixelated result.

Effects now keep their place in the stack. An Effect that registers again, because a value in its `deps` changed, goes back where it was instead of moving to the top. `CursorRipple` now stacks where it is mounted. Its UV warp and its shine used to register one render late, after every Effect beside it, so `<CursorRipple /><Grain />` added the shine over the grain. Now Grain runs over the shine.

`ShaderContextValue` and `OutputStage` replace `registerBaseUvTransform` with `registerResample`. If you call `registerBaseUvTransform` yourself, register `(sampleBeneath) => (coordinate) => sampleBeneath(warp(coordinate))` with `registerResample` instead. `registerResample` and `registerOverlay` take an optional `Slot` as their second argument. A registration under a slot that registered before goes back to that slot's place. `useResample` and `usePostProcessPass` pass one for you.
