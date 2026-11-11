# A Source owns its intro, and a composition sets it as a literal prop

Status: Accepted. Dunes lands it in SHA-318, for composition 3 (SHA-317).

A composition feels finished when its scene builds itself in as the page loads. Terrain rises from flat ground instead of fading in. A composition document holds only literal props, and ADR 0005 keeps animation code out of compositions, so nothing in a composition can play a value over time.

We chose to make each intro part of its Source. A Source with an intro takes an `intro` prop, and the Source plays the intro itself, from its own clock. A composition sets `intro` like any other literal prop, and the copied file works unchanged. Each Source designs its intro from its own shape. The package has no shared tween.

## Considered options

- **The Source exposes a progress prop, and the composition document plays it.** The Source would take a `reveal` from 0 to 1 that accepts animation signals, and the document would gain an entrance field. Rejected because the copied file would then need something to drive `reveal` over time: a tween hook from the package or the user's own animation library. A tween hook in the package starts the built-in animation library that AGENTS.md puts in v2.
- **Entrances only through Effects such as RadialWipe or Dissolve.** Rejected because a wipe uncovers a finished image. The shape doesn't build itself in. A wipe also has the same driver problem as a progress prop.

## Consequences

- An intro plays once per mount, at the scene's first frame with content. A Gallery card plays it on its first hover. A resumed hover, a Customize change, and a preset switch don't replay it.
- An intro skips to its finished state when motion is paused, as it is for posters. It also skips under reduced motion, where the 0.3× speed would make it crawl.
- `intro` is a boolean, on by default. Its duration is fixed and tuned by eye.
- A Source's intro is fixed in shape. A user who wants a different entrance turns `intro` off and drives the Source's own props with an animation signal.
- CursorTrail already owns its fade timing, so a component with its own clock isn't new.
