# Effects resample the image beneath them by wrapping a sampler, not through render targets

Status: Accepted. The output-stage change lands in its own sub-issue of SHA-266, before FlutedGlass's color split and blur.

FlutedGlass needs several samples of the image beneath it: three for its color split and twelve for its blur. The output stage gave an Effect one sample. `createOutputStage` passed the screen coordinate through every registered UV warp in turn and read the scene texture once, at the coordinate that came out. We chose to hand each Effect a function that samples everything beneath it, and the Effect returns a new function in its place. The output stage calls the last function once per pixel, at the screen coordinate. The glossary calls the Effect's rule a resample. A UV warp is the resample that calls the function beneath it once, at a moved coordinate, so Dither, CursorRipple, and CursorSmudge keep their code.

## Considered options

- **A render target per Effect.** Each Effect draws into its own texture, and the next Effect reads it. An Effect could then bend the color transforms mounted before it, such as Grain, which lifts the limit ADR 0002 accepted. The cost is a rewrite of the output stage, plus one full-screen pass and one canvas-sized texture per Effect. It stays the later option ADR 0002 names.
- **FlutedGlass reads the scene texture itself.** Rejected. That read skips every UV warp beneath it, so a CursorRipple under the glass would vanish.

## Consequences

- The stacking order of UV warps flips, and the new order is the right one. The old chain moved the screen coordinate through the first-mounted warp first, so that warp acted as the topmost layer, and `<Dither /><CursorRipple />` pixelated the water along with the image beneath it. With wrapped samplers, the last-mounted Effect is the outermost function, so its warp moves the screen coordinate first. No docs page stacks two UV warps, so no visual baseline changes. A unit test pins the order.
- Samples multiply. Each sample an Effect takes reruns every warp beneath it. Twelve blur samples times three color-split samples is 36 scene reads per pixel, and a CursorRipple beneath the glass reads its height field four times for each of them. Time a deep stack on WebGPU before you raise a sample count.
- A resample still reads only what Sources drew. Color transforms such as Grain and Vignette run after every resample, so glass mounted after Grain leaves the grain unbent. ADR 0002's limit stands.
