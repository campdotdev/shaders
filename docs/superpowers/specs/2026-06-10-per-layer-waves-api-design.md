# Per-Layer `<Waves>` API — Design Spec

**Date:** 2026-06-10
**Author:** Hunter Garrett + Claude (Opus 4.7)
**Status:** Approved, ready for plan
**Replaces:** seed at `docs/superpowers/plans/2026-06-10-per-layer-waves-api-seed.md`

## Goal

Replace the current global-only `<Waves>` prop surface with a per-layer API where the `layers` prop is an array of `WaveLayer` objects, each providing optional overrides for `color`, `amplitude`, `frequency`, `speed`, and `phase`. Sparse overrides fall back to top-level globals.

The change mirrors the pattern already established by `<LinearGradient>`: array-shaped prop drives the loop count, per-element overrides bake as JS literals into the TSL graph, material rebuilds on any change via a `remountKey`.

## Why

During the 2026-06-09 waves rebuild we landed a global prop surface (color, amplitude, frequency, speed, glow, independence, drift, baseline, layers-as-number). Two limitations surfaced on the docs page:

1. The single global `color` made it impossible to express gradient/rainbow waves — a core aesthetic users would naturally reach for.
2. The `independence` and `drift` knobs (auto-spread phase and time rate across layers) felt like half-measures for the real underlying desire: per-layer control.

This phase fixes both by lifting layers from `number` to `WaveLayer[]`.

## Component API

```tsx
interface WaveLayer {
  color?: string;
  amplitude?: number;
  frequency?: number;
  speed?: number;
  phase?: number;
}

interface WavesProps {
  // per-layer overrides — length determines layer count
  layers?: WaveLayer[];

  // globals — fallback values for per-layer fields when unset
  color?: string;
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;

  // pure globals (not per-layer)
  glow?: AnimatableProp<number>;
  baseline?: AnimatableProp<number>;
}
```

### Resolution semantics

For each layer `i` at material-build time:

```ts
resolved.color     = layer.color     ?? globals.color;       // globals.color defaulted by wrapper
resolved.amplitude = layer.amplitude ?? globals.amplitude;
resolved.frequency = layer.frequency ?? globals.frequency;
resolved.speed     = layer.speed     ?? globals.speed;
resolved.phase     = layer.phase     ?? 0;
```

The wrapper `Waves` function provides default values for all global props (e.g., `color = '#77ebce'`, `amplitude = 0.07`, etc.), so `globals.*` are always defined by the time the resolution happens inside `WavesShader`.

- Per-layer values bake as **JS literals** in the TSL graph.
- Global fallbacks for unset `amplitude`/`frequency`/`speed` flow through **live uniforms**, so scrubbing those globals affects only the layers that didn't override.
- A layer with explicit `amplitude: 0.1` is stuck at 0.1 until the layer is edited (which triggers material rebuild).
- Unset `phase` defaults to `0`, not auto-spread. The default `layers` array carries explicit phases to produce the spread look out of the box; user-provided layers behave as written (sync if `phase` is undefined).

### Default `layers`

When `layers` prop is omitted entirely:

```ts
const DEFAULT_LAYERS: WaveLayer[] = [
  { color: '#77ebce', phase: 0 },        // palette.teal.light
  { color: '#00cda6', phase: 1 / 7 },    // palette.teal.base
  { color: '#009eaf', phase: 2 / 7 },    // palette.cyan.base
  { color: '#007bc6', phase: 3 / 7 },    // palette.sky.base
];
```

Four layers, teal→cyan→sky cool-ocean progression. Hue span ~60°, well inside the design-system "stay within ~120°" guideline (`feedback_gradient_design.md` in memory). Amplitude/frequency/speed inherit from globals (defaults `0.07`, `1`, `1`).

### Removed props

| Old prop | Migration |
|---|---|
| `layers: number` | Replaced by `layers: WaveLayer[]`. Length determines count. |
| `independence: number` | Removed. Set per-layer `phase` instead. |
| `drift: number` | Removed. Set per-layer `speed` instead. |
| `color: string` (sole) | Still works as a global fallback; per-layer `color` overrides. |

This is a breaking API change. Treated as a fast-follow on the just-shipped global-prop rebuild — no deprecation cycle (the rebuild branch hasn't merged yet; we're piling onto the same feature branch).

### Bounds

- `MIN_LAYERS = 1`
- `MAX_LAYERS = 12`

12 chosen over the current rebuild's 20: per-layer config in the Tweakpane UI becomes unwieldy past ~12, and the proximity-glow aesthetic doesn't gain much from extreme layer counts.

## Shader changes (`registry/waves/shader.tsx`)

The `for` loop iterates `layers.length` times, not a hardcoded `10`. Per iteration:

```ts
for (let i = 0; i < layers.length; i += 1) {
  const layer = layers[i]!;

  const ampNode  = layer.amplitude !== undefined ? float(layer.amplitude) : ampUniform;
  const freqNode = layer.frequency !== undefined ? float(layer.frequency) : freqUniform;
  const speedNode = layer.speed !== undefined ? float(layer.speed) : speedUniform;
  const phase    = layer.phase ?? 0;
  const [cr, cg, cb] = parseHex(layer.color ?? props.color);

  const layerTime = time.mul(speedNode);

  yRunning = yRunning.add(
    wobble(p.x.mul(freqNode).add(phase).add(layerTime)).mul(ampNode),
  );

  const width = yRunning.mul(150).abs().reciprocal().mul(glowUniform);

  waveColor = waveColor.add(vec3(width.mul(cr), width.mul(cg), width.mul(cb)));
}
```

The TSL graph branches per layer at JS-build time depending on which fields are set. Some layers get TSL literal nodes via `float(...)`, some use the global uniform. All resolved into the final compiled shader expression.

### Hooks removed

- `independenceUniform`
- `driftUniform`

### Hooks retained

- `ampUniform`, `freqUniform`, `speedUniform` — still used as global fallbacks.
- `glowUniform`, `baselineUniform` — pure globals.

### Material rebuild trigger

`<Waves>` gains a `key={remountKey}` based on a stringified summary of the `layers` array. On any layer field change (count, color, scalar), React unmounts the component and remounts it, which builds a fresh material. Mirrors LinearGradient's `remountKey = colors.join('|') + '|' + stops.join('|')`.

```ts
const remountKey = layers.map(
  (l) => `${l.color ?? ''}|${l.amplitude ?? ''}|${l.frequency ?? ''}|${l.speed ?? ''}|${l.phase ?? ''}`,
).join('||');
```

Live globals (`glow`, `baseline`, plus unset `amplitude`/`frequency`/`speed`) continue to drive uniforms and don't trigger remount.

## Tweakpane page UX (`apps/docs/src/app/components/waves/page.tsx`)

Full rewrite, copy-adapting `apps/docs/src/app/components/linear-gradient/page.tsx`.

Structure:

1. Global props (live sliders): `color` (fallback default), `amplitude`, `frequency`, `speed`, `glow`, `baseline`.
2. Separator.
3. **"Layers" folder.** Static parent; contents fully rebuilt on every add/remove. Inside:
   - For each layer at index `i`: a sub-folder titled `Layer {i}` (expanded), containing:
     - `color` color picker
     - `amplitude` slider, range `0–0.3`, step `0.005`
     - `frequency` slider, range `0.1–10`, step `0.05`
     - `speed` slider, range `0–4`, step `0.05`
     - `phase` slider, range `0–2`, step `0.01`
     - "Remove layer" button (disabled when `layers.length <= MIN_LAYERS`)
   - "+ Add layer" button at the bottom (disabled when `layers.length >= MAX_LAYERS`).
4. New-layer default: copy the previous layer's color and phase + `1/7`; amplitude/frequency/speed unset (inherit globals). Matches LinearGradient's "duplicate last + shift position" UX.
5. State management: `params.layers` is a fresh array on every change. The `<Waves>` component reads `params.layers` and computes `remountKey` from it.

### Code/JSX format helpers

Borrow LinearGradient's `fmtJsx` / `fmtParams` / copy-button pattern via `addCopyButtons(pane, jsxFn, paramsFn)`. The inline code block in the page (currently a static string) is replaced with a live-formatted JSX snippet that always reflects the current Tweakpane state.

## Other consumer updates

- `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx`: replace the old `<Waves amplitude={0.1} color="#77eecc" frequency={5} layers={3} speed={1} />` with new API. Keep visual close to current: `<Waves layers={[{ color: '#77eecc' }, ...]} />` or even just `<Waves />` (use defaults — the demo's point is reduced-motion behavior, not visual specifics).

- `registry/registry.json`: update `waves` entry's `description` (mention per-layer API) and ensure `uses_primitives` is current (`cos`, `uv`, `vec2`, `vec3`, `vec4`, `time`, `uniform`, `float`).

## Visual regression

`apps/docs-tests/visual/waves.spec.ts-snapshots/*.png` will be rebaselined for the new default look (4 cool-ocean layers vs. previous 10 monochrome teal).

Note: the broader visual regression suite has pre-existing flake across 6 of 7 component tests (see commit `bf5b0dc`). Not addressed in this phase.

## Testing

No unit tests — shader visuals are tested via the docs page demo + Tweakpane interaction + Playwright snapshot rebaseline. Matches the testing philosophy laid out in CLAUDE.md ("there is no meaningful unit test for 'does this gradient look right'").

Verification surface:

1. `pnpm typecheck` — green across all packages.
2. `pnpm lint` — green on `@matter/registry` and `@matter/docs`.
3. `pnpm format:check` — green.
4. Dev server (`pnpm --filter @matter/docs dev`) at `/components/waves`:
   - Default view: 4 cool-ocean layers visible.
   - Add Layer button increases count up to 12; Remove Layer decreases down to 1.
   - Per-layer color picker changes only that layer's color (triggers brief flicker on rebuild).
   - Global `amplitude` slider changes the height of layers that don't override.
   - A layer that overrides `amplitude` ignores the global slider.
   - `glow` and `baseline` sliders update live, no flicker.
5. `apps/docs/src/app/dev/reduced-motion` page still renders waves, freezes correctly when policy is paused.
6. `pnpm --filter @matter/docs-tests test:visual:update -- visual/waves.spec.ts` produces a clean rebaseline.

## Out of scope (deferred)

- Vec2/vec3 wobble helper (for use beyond waves)
- Promoting `wobble` to `@lovo/matter` engine primitives (YAGNI until a second consumer surfaces)
- Auto-spread convenience methods on the Tweakpane page (e.g., "Spread phases" button) — easy to add later if useful
- Animating per-layer values (would require live uniforms instead of literal bake — major architectural change)

## Open questions

None at design time. All resolved during brainstorming on 2026-06-10.
