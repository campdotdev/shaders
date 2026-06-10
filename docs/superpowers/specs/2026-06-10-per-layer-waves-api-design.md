# Per-Layer `<Waves>` API — Design Spec

**Date:** 2026-06-10
**Author:** Hunter Garrett + Claude (Opus 4.7)
**Status:** Approved, ready for plan
**Replaces:** seed at `docs/superpowers/plans/2026-06-10-per-layer-waves-api-seed.md`

## Goal

Replace the current global-only `<Waves>` prop surface with a per-layer API where the `layers` prop is an array of `WaveLayer` objects, each providing optional overrides for `color`, `amplitude`, `frequency`, `speed`, `offset`, and `motion`. Scalar overrides fall back to top-level master controls.

The change mirrors the pattern already established by `<LinearGradient>`: array-shaped prop drives the loop count, per-element overrides bake as JS literals into the TSL graph, material rebuilds on any change via a `remountKey`.

## Why

During the 2026-06-09 waves rebuild we landed a global prop surface (color, amplitude, frequency, speed, glow, independence, drift, baseline, layers-as-number). Two limitations surfaced on the docs page:

1. The single global `color` made it impossible to express gradient/rainbow waves — a core aesthetic users would naturally reach for.
2. The `independence` and `drift` knobs (auto-spread offset and time rate across layers) felt like half-measures for the real underlying desire: per-layer control.

This phase fixes both by lifting layers from `number` to `WaveLayer[]`.

## Component API

```tsx
interface WaveLayer {
  color?: string;
  amplitude?: number;
  frequency?: number;
  speed?: number;
  glow?: number;
  thickness?: number;
  offset?: number;
  motion?: number;
}

interface WavesProps {
  // per-layer overrides — length determines layer count
  layers?: WaveLayer[];

  // globals — master values for per-layer fields
  amplitude?: AnimatableProp<number>;
  frequency?: AnimatableProp<number>;
  speed?: AnimatableProp<number>;

  // global controls
  glow?: AnimatableProp<number>;
  thickness?: AnimatableProp<number>;
  baseline?: AnimatableProp<number>;
}
```

### Resolution semantics

For each layer `i` at material-build time:

```ts
resolved.color     = layer.color     ?? '#ff6f6a';           // defensive internal fallback
resolved.amplitude = layer.amplitude === undefined ? globals.amplitude : globals.amplitude * (layer.amplitude / 0.07);
resolved.frequency = layer.frequency === undefined ? globals.frequency : globals.frequency * layer.frequency;
resolved.speed     = layer.speed     === undefined ? globals.speed     : globals.speed * layer.speed;
resolved.glow      = layer.glow      === undefined ? globals.glow      : globals.glow * layer.glow;
resolved.thickness = layer.thickness === undefined ? globals.thickness : globals.thickness * layer.thickness;
resolved.offset    = layer.offset    ?? 0;
resolved.motion    = layer.motion    ?? 0.35;
```

The wrapper `Waves` function provides default values for all global props (e.g., `amplitude = 0.09`, `glow = 0.72`, etc.), so `globals.*` are always defined by the time the resolution happens inside `WavesShader`.

- Per-layer values bake as **JS literals** in the TSL graph.
- Global `amplitude`/`frequency`/`speed`/`glow`/`thickness` flow through **live uniforms** and act as master controls. Per-layer values preserve relative differences against the component defaults.
- Unset `offset` defaults to `0`, not auto-spread. The default `layers` array carries explicit offsets to produce the spread look out of the box; user-provided layers behave as written (sync if `offset` is undefined).
- Unset `motion` defaults to `0.35`; higher values add counter-moving harmonic motion so a layer evolves instead of only sliding sideways.
- Unset `glow` inherits the global master value, which defaults to `0.72`; higher values make that layer brighter.
- Unset `thickness` inherits the global master value, which defaults to `0.65`; higher values make the wave band visually thicker.

### Default `layers`

When `layers` prop is omitted entirely:

```ts
const DEFAULT_LAYERS: WaveLayer[] = [
  { color: '#ff6f6a', amplitude: 0.045, frequency: 0.75, speed: 0.55, glow: 0.55, thickness: 0.45, offset: 0, motion: 0.12 },     // palette.red.light
  { color: '#ecb100', amplitude: 0.065, frequency: 1.05, speed: 0.8, glow: 0.62, thickness: 0.55, offset: 1.57, motion: 0.32 },   // palette.amber.base
  { color: '#0ae24b', amplitude: 0.09, frequency: 1.35, speed: 1.05, glow: 0.7, thickness: 0.65, offset: 3.14, motion: 0.52 },    // palette.green.base
  { color: '#4370f0', amplitude: 0.115, frequency: 1.7, speed: 1.3, glow: 0.78, thickness: 0.75, offset: 4.71, motion: 0.72 },    // palette.blue.light
];
```

Four layers, red→amber→green→blue rainbow progression. Hue span is intentionally broad so the layers are easy to distinguish while tuning. The default global amplitude/glow/thickness are restrained (`0.09`, `0.72`, `0.65`), while per-layer amplitude/frequency/speed/offset values are spread out to reduce overlap.

### Removed props

| Old prop | Migration |
|---|---|
| `layers: number` | Replaced by `layers: WaveLayer[]`. Length determines count. |
| `independence: number` | Removed. Set per-layer `offset` instead. |
| `drift: number` | Removed. Set per-layer `speed` instead. |
| `color: string` (top-level) | Removed. Set `color` on each layer instead. |

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
  const glowNode = layer.glow !== undefined ? float(layer.glow) : glowUniform;
  const thicknessNode = layer.thickness !== undefined ? float(layer.thickness) : thicknessUniform;
  const offset   = layer.offset ?? 0;
  const motion   = layer.motion ?? 0.35;
  const [cr, cg, cb] = parseHex(layer.color ?? DEFAULT_LAYER_COLOR);

  const layerTime = time.mul(speedNode);
  const waveInput = p.x.mul(freqNode).add(offset);
  const baseWave = wobble(waveInput.add(layerTime));
  const motionWave = cos(waveInput.mul(1.7).sub(layerTime.mul(0.55)))
    .add(cos(waveInput.mul(0.43).add(layerTime.mul(1.35))))
    .mul(0.25);
  const wave = baseWave.add(motionWave.mul(motion));

  yRunning = yRunning.add(
    wave.mul(ampNode),
  );

  const width = yRunning.mul(150).abs().reciprocal().mul(thicknessNode).mul(glowNode);

  waveColor = waveColor.add(vec3(width.mul(cr), width.mul(cg), width.mul(cb)));
}
```

The TSL graph branches per layer at JS-build time depending on which fields are set. Some layers get TSL literal nodes via `float(...)`, some use the global uniform. All resolved into the final compiled shader expression.

### Hooks removed

- `independenceUniform`
- `driftUniform`

### Hooks retained

- `ampUniform`, `freqUniform`, `speedUniform` — still used as global master controls.
- `glowUniform`, `thicknessUniform`, `baselineUniform` — global controls.

### Material rebuild trigger

`<Waves>` gains a `key={remountKey}` based on a stringified summary of the `layers` array. On any layer field change (count, color, scalar), React unmounts the component and remounts it, which builds a fresh material. Mirrors LinearGradient's `remountKey = colors.join('|') + '|' + stops.join('|')`.

```ts
const remountKey = layers.map(
  (l) => `${l.color ?? ''}|${l.amplitude ?? ''}|${l.frequency ?? ''}|${l.speed ?? ''}|${l.glow ?? ''}|${l.thickness ?? ''}|${l.offset ?? ''}|${l.motion ?? ''}`,
).join('||');
```

Live globals (`glow`, `thickness`, `baseline`, plus unset `amplitude`/`frequency`/`speed`) continue to drive uniforms and don't trigger remount.

## Tweakpane page UX (`apps/docs/src/app/components/waves/page.tsx`)

Full rewrite, copy-adapting `apps/docs/src/app/components/linear-gradient/page.tsx`.

Structure:

1. Global props (live sliders): `amplitude`, `frequency`, `speed`, `glow`, `thickness`, `baseline`.
2. Separator.
3. **"Layers" folder.** Static parent; contents fully rebuilt on every add/remove. Inside:
   - For each layer at index `i`: a sub-folder titled `Layer {i}` (expanded), containing:
     - `color` color picker
     - `amplitude` slider, range `0–0.3`, step `0.005`
     - `frequency` slider, range `0.1–10`, step `0.05`
     - `speed` slider, range `0–4`, step `0.05`
     - `glow` slider, range `0–3`, step `0.01`
     - `thickness` slider, range `0.1–4`, step `0.01`
     - `offset` slider, range `0–6.28`, step `0.01`
     - `motion` slider, range `0–1`, step `0.01`
     - "Remove layer" button (disabled when `layers.length <= MIN_LAYERS`)
   - "+ Add layer" button at the bottom (disabled when `layers.length >= MAX_LAYERS`).
4. New-layer default: copy the previous layer's color and offset + `1/7`; amplitude/frequency/speed unset (inherit globals). Matches LinearGradient's "duplicate last + shift position" UX.
5. State management: `params.layers` is a fresh array on every change. The `<Waves>` component reads `params.layers` and computes `remountKey` from it.

### Code/JSX format helpers

Borrow LinearGradient's `fmtJsx` / `fmtParams` / copy-button pattern via `addCopyButtons(pane, jsxFn, paramsFn)`. The inline code block in the page (currently a static string) is replaced with a live-formatted JSX snippet that always reflects the current Tweakpane state.

## Other consumer updates

- `apps/docs/src/app/dev/reduced-motion/ReducedMotionDemo.tsx`: replace the old `<Waves amplitude={0.1} color="#77eecc" frequency={5} layers={3} speed={1} />` with new API. Keep visual close to current: `<Waves layers={[{ color: '#77eecc' }, ...]} />` or even just `<Waves />` (use defaults — the demo's point is reduced-motion behavior, not visual specifics).

- `registry/registry.json`: update `waves` entry's `description` (mention per-layer API) and ensure `uses_primitives` is current (`cos`, `uv`, `vec2`, `vec3`, `vec4`, `time`, `uniform`, `float`).

## Visual regression

`apps/docs-tests/visual/waves.spec.ts-snapshots/*.png` will be rebaselined for the new default look (4 rainbow layers vs. previous 10 monochrome teal).

Note: the broader visual regression suite has pre-existing flake across 6 of 7 component tests (see commit `bf5b0dc`). Not addressed in this phase.

## Testing

No unit tests — shader visuals are tested via the docs page demo + Tweakpane interaction + Playwright snapshot rebaseline. Matches the testing philosophy laid out in CLAUDE.md ("there is no meaningful unit test for 'does this gradient look right'").

Verification surface:

1. `pnpm typecheck` — green across all packages.
2. `pnpm lint` — green on `@matter/registry` and `@matter/docs`.
3. `pnpm format:check` — green.
4. Dev server (`pnpm --filter @matter/docs dev`) at `/components/waves`:
   - Default view: 4 rainbow layers visible.
   - Add Layer button increases count up to 12; Remove Layer decreases down to 1.
   - Per-layer color picker changes only that layer's color (triggers brief flicker on rebuild).
   - Global `amplitude` slider changes the height of layers that don't override.
   - A layer that overrides `amplitude` ignores the global slider.
   - `glow`, `thickness`, and `baseline` sliders update live, no flicker.
5. `apps/docs/src/app/dev/reduced-motion` page still renders waves, freezes correctly when policy is paused.
6. `pnpm --filter @matter/docs-tests test:visual:update -- visual/waves.spec.ts` produces a clean rebaseline.

## Out of scope (deferred)

- Vec2/vec3 wobble helper (for use beyond waves)
- Promoting `wobble` to `@lovo/matter` engine primitives (YAGNI until a second consumer surfaces)
- Auto-spread convenience methods on the Tweakpane page (e.g., "Spread offsets" button) — easy to add later if useful
- Animating per-layer values (would require live uniforms instead of literal bake — major architectural change)

## Open questions

None at design time. All resolved during brainstorming on 2026-06-10.
