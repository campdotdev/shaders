# An Effect that draws its own passes still reads the image beneath through the sampler

Status: Accepted. Bloom lands it in SHA-91.

Bloom spills light from the bright parts of the image beneath it. The spill is a wide blur, and a wide blur at full size costs hundreds of samples per pixel. So Bloom blurs through a chain of smaller textures: it draws the bright parts at half size, halves that again several times, and adds the levels back up. Bloom is the first Effect that owns render targets. ADR 0004's title says Effects resample "not through render targets", so a reader of ADR 0004 won't expect them.

We chose a narrower rule than ADR 0004's title. An Effect may draw passes of its own, but it reads the image beneath only through `sampleBeneath`, and it returns its result through the sampler it registers. Bloom's first pass draws what `sampleBeneath` returns, so every resample beneath Bloom reaches the glow. The sampler Bloom returns reads the image and the glow at the same coordinate, so a UV warp mounted above Bloom moves both together.

The chain reads the scene, so it draws after the scene pass. A node in Bloom's sampler graph draws it from `updateBefore`, which three calls during the output quad's draw. The chain's first pass has a material of its own, and that material's graph holds the scene's pass node, because the read went through `sampleBeneath`. three draws a pass before it draws any material that holds the pass's node, so the scene is drawn before the chain's first pass, whichever node three reaches first. The output stage doesn't change.

## Considered options

- **Bloom's chain reads the scene texture itself.** It is cheaper, because the resamples beneath Bloom don't run again for the chain. Rejected for the reason ADR 0004 rejected the same read for FlutedGlass: it skips every resample beneath. A CursorRipple under Bloom would ripple the image and leave the glow still, and the docs would need a rule to mount Bloom directly above the Sources.
- **A `registerPostPass` hook on the output stage.** The stage would draw the scene pass itself, run the post-passes, and then draw the quad. The order would be explicit. Rejected because the stage would have to replace three's `pass()` with a target of its own and copy what `pass()` sets up, for one consumer.
- **three's `BloomNode`.** Rejected because it blurs with ten Gaussian passes, its threshold is nearly hard, and its input is a texture node, which would be the scene-texture read above.

## Consequences

- The resamples beneath Bloom run once more per pixel of the canvas. The chain's first level is half the canvas's size, and it reads the image four times per texel, once at each pixel the texel covers, so that the bright pass sees single pixels. One read per texel would average the four first, and a bright spot one pixel wide, such as one of Swells' glints, would fall below the threshold. Time a deep stack on WebGPU before a composition puts Bloom over an Effect that takes many samples.
- The draw order rests on how three updates nodes. `output-stage.test.ts` fails if a read through `sampleBeneath` stops carrying the scene's pass node. Both nodes update once per three frame, so two draws inside one browser frame draw the scene and the chain once. At a three upgrade, run that test and open `/dev/bloom-probe`.
- Bloom rebuilds its first pass whenever the output stage rebuilds, because the stage hands it a new `sampleBeneath` each time.
- ADR 0004's limit stands. Bloom reads what the Sources drew, as changed by the resamples beneath it. A color transform such as Grain runs after every resample, so Bloom never blooms the grain.
- A render target per Effect, the later option ADR 0002 and ADR 0004 name, is still not built. Bloom's targets hold its own blur, not the stack's image.
