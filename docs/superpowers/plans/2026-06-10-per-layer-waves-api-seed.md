# Per-layer `<Waves>` API — Phase 6 seed

> Not a full plan — a placeholder to remember why we deferred this and what the design space looks like when we get to it. Promote to a real plan when we're ready to execute.

## Why this exists

During the 2026-06-09 waves rebuild, we got to Phase 4 (prop surface) and the user surfaced two related desires:

1. Add/remove layers with finer control than the current `layers: number` slider.
2. Adjust per-layer parameters independently (each layer's own color, amplitude, frequency, speed, drift).

We agreed the current rebuild scope (single-shape TSL graph driven by global uniforms) is the wrong substrate for that — it'd require ripping out and redesigning. So we shipped the current rebuild with global props, including a `drift` prop that gives the over-time per-layer variance feel without per-layer config.

## Reference pattern: `LinearGradient`'s color stops

The closest existing implementation in the repo. Concretely:

- **Component API:** parallel arrays `colors: string[]` + `stops: number[]` whose length determines layer count.
- **Tweakpane page:** a "Color stops" folder containing per-stop sub-folders (color picker + position slider + "Remove" button), plus a "+ Add stop" button. Tweakpane folders are static, so the folder is fully rebuilt on every add/remove.
- **TSL graph:** per-stop values baked as JS literals (`vec3`, scalar positions). Gotcha #17 exception — colors don't drive at interactive frequency, so the rebuild cost is acceptable.
- **Material rebuild:** triggered via `key={remountKey}` where `remountKey` is a stringified concat of colors + positions. Any change → React remounts the component → fresh material.
- **Constants:** `MIN_STOPS = 1`, `MAX_STOPS = 6`.

See [linear-gradient/page.tsx](../../apps/docs/src/app/components/linear-gradient/page.tsx) for the full implementation.

## Proposed shape for waves

```ts
interface WaveLayer {
  color?: string;
  amplitude?: number;
  frequency?: number;
  speed?: number;
  drift?: number;
  phase?: number;  // could subsume independence's static-spread role
}

interface WavesProps {
  layers?: WaveLayer[];

  // global fallbacks for unset per-layer fields
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;
  color?: string;
  glow?: AnimatableProp<number>;
}
```

Per-layer values fall back to globals when undefined. Empty `layers={[{}, {}, {}]}` means three identical layers using all-global params.

## Open questions to answer at design time

- **Hook discipline.** React hooks can't be called in a variable-length loop. LinearGradient sidesteps this by baking everything as literals (no per-stop hooks). Same approach works here — every `WaveLayer` field becomes a literal in the TSL graph. Live tweaking of per-layer values still requires remount + rebuild. That's the explicit tradeoff.
- **`independence` after this lands.** If `phase` becomes a per-layer field, `independence`'s static-spread role goes away. We'd keep `independence` only as a convenience global (auto-spread across N layers when no per-layer phase is set), OR drop it entirely. Default behavior of unset `phase` would need to mimic the current `i/7` spread.
- **`layers: number` → `layers: WaveLayer[]`.** Breaking API change. The current rebuild kept the `layers: number` shape on purpose to defer this. Phase 6 is where the migration happens.
- **Tweakpane UX.** Folder-of-folders, copy LinearGradient's `rebuildStops` pattern. Add "+ Add layer" / "Remove layer" buttons. Per-layer folders contain color + amplitude + frequency + speed + drift + phase bindings.
- **Defaults.** What's a sensible `MIN_LAYERS` / `MAX_LAYERS`? LinearGradient does 1-6 because color stops degrade quickly past that. Waves can probably handle 1-20 without performance issues.

## Trigger to promote to a real plan

- Either: user explicitly asks "do the per-layer waves API now"
- Or: a third unrelated request surfaces that wants per-layer waves control (e.g., a docs page that needs gradient-colored bands)

When one of those fires, brainstorm + writing-plans skills, normal phase intake.
