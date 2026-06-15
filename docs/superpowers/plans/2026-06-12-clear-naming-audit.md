# Clear-Naming Audit & Rename Plan (MAT-34)

> Goal: eliminate ambiguous, abbreviated, and overly-terse identifiers across the
> codebase in favor of long, clear, self-explanatory names. Includes shader-math
> locals, the `U` uniform-suffix convention, user-facing recipe snippets, and test
> files. Scope decisions confirmed with the user on 2026-06-12.

## Scope decisions (confirmed)

This is a **pre-release** library (`v0.4.1`, no stability guarantee yet), so **breaking
changes to the public API are acceptable** and explicitly in scope.

| Question | Decision |
| --- | --- |
| Shader/TSL math locals (`p`, `t`, `n`, `c`, `s`, `r`/`g`/`b`) | **Rename all** to clear names (e.g. `p` → `samplePosition`). |
| Trailing `U` = "uniform" (`speedU`, `driftXU`) | **Expand** to `...Uniform` (`speedUniform`, `driftXUniform`). |
| Display-string recipe snippets (`recipes.ts`, `_builds.ts`) | **Rename** for consistency — users see clear names. |
| Test files (`*.test.ts(x)`) | **Include** in the rename pass. |
| Public API (exports, hooks, props, CLI flags, config keys) | **In scope.** Spell out shader-domain jargon (`fbm` → `fractalNoise`). For props, apply a **"longer only if clearer" test** — rename a prop only when the new name adds real meaning (resolves "X of what?") or fixes a cross-component inconsistency; keep names that already convey intent. |

## Canonical naming conventions

To keep renames consistent across files, apply these standard mappings everywhere
the pattern appears (these resolve most of the catalog below):

| Pattern | Current | Rename to |
| --- | --- | --- |
| Shader context hook result | `ctx` | `shaderContext` (`shaderContextValue` when it's the context-value object/state) |
| Callback / listener params | `cb`, `l` | `changeCallback` (type position) / `listener` (iteration position) |
| Subscription sets | `subs` | `subscriptions` |
| Observer instances | `obs` | `observer` |
| Media query list | `mql`, `mqlHandler` | `mediaQueryList`, `mediaQueryListHandler` |
| `requestAnimationFrame` id | `raf` | `animationFrameId` |
| Hex → RGB destructure | `[r, g, b]` | `[redChannel, greenChannel, blueChannel]` |
| Cleaned hex string | `c` | `cleanedHex` |
| Canvas/resize dimensions | `w`, `h`, `iw`, `ih`, `w2`, `h2` | `canvasWidth`, `canvasHeight`, `initialWidth`, `initialHeight`, `updatedWidth`, `updatedHeight` |
| Element rect dimensions | `r`, `w`, `h` | `elementRect`, `elementWidth`, `elementHeight` |
| Cursor change tuple | `[x, y]` | `[cursorX, cursorY]` |
| Uniform suffix | `…U` | `…Uniform` |
| Color-index helper | `i` (in `evenAt`) | `colorIndex` |
| Loop counters | `i`, `j` | descriptive (`layerIndex`, `listenerIndex`, …) |
| `cos`/`sin` locals | `c`, `s`, `lc`, `ls` | `cosineValue`/`sineValue`, `layerCosine`/`layerSine` |
| Delta time | `dt` | `deltaTimeSinceLastSample` |
| Accumulator | `acc` | `fpsAccumulator` |
| Generic value param in type guards | `x`, `v` | `value` |
| Caught errors | `err`, `e` | `caughtError` / `normalizedError` |
| Foreground/background | `fg` / `bg` | `foregroundColor` / `backgroundColor` |
| Abort controller | `ac` | `abortController` |
| Normalized search query | `q` | `normalizedQuery` |

### Shader-math local conventions (apply consistently)

| Current | Rename to |
| --- | --- |
| `p` (position) | `samplePosition` |
| `t` (time-scaled) | `scaledTime` (or `timeScaled` / `normalizedStripe` per local meaning) |
| `n` (noise) | `noiseValue` |
| `f` (fbm) | `fbmValue` |
| `v` (voronoi / value) | `voronoiValue` / `value` |
| `g` (grayscale) | `grayscaleNormalized` |
| `q` (quantized) | `quantizedValue` |
| `c` (ramped/mixed color) | `rampedColor` / `mixedColor` |

---

## Catalog of findings

Roughly **270+ occurrences across 60+ files**, grouped by package. Tables list
representative occurrences; the rename pass applies the canonical mappings above to
every instance in each file (use editor rename-symbol so all references update).

### 1. `packages/matter` (engine) — ~61 occurrences

| File | Lines | Current | Rename to |
| --- | --- | --- | --- |
| `src/inputs/cursor-input/cursor-input.ts` | 62 | `me` | `mouseEvent` |
| | 70–72 | `r`, `w`, `h` | `elementRect`, `elementWidth`, `elementHeight` |
| | 79–80 | `w`, `h` | `viewportWidth`, `viewportHeight` |
| | 96, 99 | `_event`, `cb` | `eventType`, `changeListener` |
| | 133–134 | `n`, `a`, `b`, `t` (`clamp01`/`lerp`) | `value`, `startValue`, `endValue`, `blendFactor` |
| `src/primitives/fbm/fbm.ts` | 46–47 | `amp`, `freq` | `amplitude`, `frequency` |
| `src/primitives/color-ramp/color-ramp.ts` | 49, 53 | `prev`, `span` | `previousStop`, `positionSpan` |
| `src/primitives/quantize/quantize.ts` | 17 | `denom` | `denominator` |
| `src/runtime/create-renderer/create-renderer.ts` | 69–70 | `w`, `h` | `canvasWidth`, `canvasHeight` |
| `src/runtime/reduced-motion/reduced-motion.ts` | 52, 65, 101 | `cb` | `scaleChangeCallback` / `listener` |
| | 91, 95, 96, 115 | `subs`, `mql`, `last`, `s` | `subscriptions`, `mediaQueryList`, `lastComputedScale`, `scale` |
| `src/runtime/intersection/intersection.ts` | 28, 30, 32, 36 | `subs`, `obs`, `e`, `cb` | `subscriptions`, `observer`, `entry`, `listener` |
| `src/runtime/visibility/visibility.ts` | 22, 23, 26 | `subs`, `v`, `cb` | `subscriptions`, `isVisible`, `listener` |
| Tests (`*.test.ts`) | various | `n`, `q`, `w`, `cb`, `l`, `i`, `obs`, `u` | `noiseValue`/`fbmValue`/`grainValue`, `quantizedValue`, `watcher`, `listener`, `listenerIndex`, `observer`, `timeScaleUniform` |

> Clean already (no changes): `index.ts`, `voronoi.ts`, `cursor-ripple.ts`, `time.ts`,
> `sdf-circle.ts`, `displace.ts`, `frame-scheduler.ts` and their tests.

### 2. `packages/matter-react` (binding) — ~40 occurrences

| File | Lines | Current | Rename to |
| --- | --- | --- | --- |
| `hooks/use-overlay-pass/use-overlay-pass.ts` (+ test) | 9, 20, 37 | `ctx` | `shaderContext` / `shaderContextValue` |
| `hooks/use-resize/use-resize.ts` | 12, 21, 49, 56, 57 | `cb`, `ctx`, `mql`, `mqlHandler` | `changeCallback`/`listener`, `shaderContext`, `mediaQueryList`, `mediaQueryListHandler` |
| `hooks/use-animatable-uniform/…` (+ test) | 11, 19, 33, 62 | `cb`, `v` | `changeCallback`/`listener`, `propValue` |
| `hooks/use-static-hint/use-static-hint.ts` | 8 | `ctx` | `shaderContext` |
| `hooks/use-shader-material/use-shader-material.ts` | 13 | `m` | `material` |
| `hooks/use-cursor/use-cursor.ts` (+ test) | 11, 20, 26, 33, 38–50, 36 | `cb`, `ctx`, `fresh`, `client`, `raf`, `v` | `changeCallback`, `shaderContext`, `newCursorInput`, `schedulerTickHandler`, `animationFrameId`, `newValue` |
| `hooks/use-scroll/use-scroll.ts` | 11, 26, 49 | `cb`, `y`, `cb` | `changeCallback`, `scrollYPosition`, `listener` |
| `components/shader-monitor/shader-monitor.tsx` (+ test) | 34, 41, 43, 47, 9 | `ctx`, `client`, `acc`, `dt`, `wrap` | `shaderContext`, `tickHandler`, `fpsAccumulator`, `deltaTimeSinceLastSample`, `createSchedulerWrapper` |
| `components/shader-scene/shader-scene.tsx` | 42, 78, 131, 133 | `ctx`, `node`, `err`, `e` | `shaderContextValue`, `currentPipeline`, `caughtError`, `normalizedError` |
| `internal/create-signal.ts` | 4, 5, 13 | `cb`, `v` | `changeCallback`/`listener`, `callbackValue` |

### 3. `packages/matter-cli` — ~48 occurrences

| File | Lines | Current | Rename to |
| --- | --- | --- | --- |
| `commands/poster.ts` | 30–34, 132, 141–143 | `t`, `v`, `n`, `idx` | `typeInput`, `normalizedType`, `byteCount`, `publicPathIndex` |
| `commands/add.ts` | 35–64, 53, 96–98 | `cfg`, `r`, `p` | `matterConfig`, `resolvedComponent`, `filePath` |
| `commands/list.ts` | 25–27, 35 | `cfg`, `[a]`/`[b]` | `matterConfig`, `leftSlug`/`rightSlug` |
| `commands/update.ts` | 27–31 | `cfg` | `matterConfig` |
| `commands/init.ts` | 21 | `cfg` | `matterConfig` |
| `transforms/rewriteImports.ts` | 2 | `[a]`/`[b]` | `leftAlias`/`rightAlias` |
| `poster/bundle.ts` | 104 | `f` | `outputFile` |
| `poster/server.ts` | 23, 64 | `req`, `res`, `err` | `request`, `response`, `closeError` |
| `poster/playwright.ts` | 99, 106, 107 | `ctx`, `e`, `msg` | `browserContext`, `pageError`, `consoleMessage` |
| `config/validate.ts` | 3, 11 | `x`, `obj` | `value`, `parsedObject` |
| `registry/fetchRegistry.ts` | 41 | `x` | `value` |
| `harness/index.tsx` | 11 | `v` | `value` |
| Tests (`*.test.ts`) | various | `cfg`, `a`, `b`, `c`, `l`, `s`, `x` | `matterConfig`, `…Content`, `call`/`logLine`, `fileStats`, `value` |

### 4. `registry/` (shader components) — ~63 occurrences

| File | Lines | Current | Rename to |
| --- | --- | --- | --- |
| `utils/color.ts` | 2 | `c` | `cleanedHex` |
| `dot-field.tsx` | 48–50, 81, 114, 124–127 | `r`/`g`/`b`, `zeroScalar`, `[x,y]`, `w`/`h`/`w2`/`h2` | `redChannel`/…, `originScalar`, `cursorX`/`cursorY`, `canvasWidth`/`canvasHeight`/`updatedWidth`/`updatedHeight` |
| `linear-gradient/shader.tsx` | 27, 67, 86, 89 | `v`, `[x,y]`, `i`, `[r,g,b]` | `value`, `cursorX`/`cursorY`, `colorIndex`, RGB channels |
| `mesh-gradient/shader.tsx` | 32, 35, 49–50, 83–140 | `[r,g,b]`, `iw`/`ih`, `a0…b3`, `w`/`h`/`w2`/`h2`, `c`/`s`, `rx`/`ry`/`ryUnit`, `tuv*`, `tspeed`, `lc`/`ls`, `hMix`/`vMix` | RGB channels, `initialWidth`/`initialHeight`, `paletteAColor0…`/`paletteBColor3`, canvas dims, `cosineValue`/`sineValue`, `rotatedX`/`rotatedY`/`rotatedYUnit`, `rotatedTextureCoordinates`/`warpedTextureCoordinates`, `timeScaledBySpeed`, `layerCosine`/`layerSine`, `horizontalMix`/`verticalMix` |
| `simplex-noise/shader.tsx` | 30–35, 68, 76, 78 | `ctx`, `scaleU…softnessU`, `t`, `i`, `[r,g,b]` | `shaderContext`, `…Uniform`, `focusedBias`, `colorIndex`, RGB channels |
| `vignette/shader.tsx` | 48, 69, 73 | `[r,g,b]`, `w`/`h`, `w2`/`h2` | RGB channels, canvas dims |
| `waves/shader.tsx` | 37, 41, 67, `.map((l)` | `t`, `p`, `l` | `timeValue`, `samplePosition`, `layer` |
| `aurora/shader.tsx` | 63–210 | `[r,g,b]`, `w`/`h`/`w2`/`h2`, `[x,y,b]`, `i`, `lu`, `t`, `p`, `n`, `…U` | RGB channels, canvas dims, `directionX`/`directionY`/`directionBias`, `layerIndex`, `layerUniform`, `scaledTime`, `driftPosition`, `noiseValue`, `…Uniform` |
| Component wrappers (`*.tsx`) | various | `a0…b3` etc. | palette/array-based clear names |

> Note: registry files are copied verbatim into user projects via the CLI. Clearer
> names here directly improve the copy-paste developer experience.

### 5. `apps/docs` — ~65 occurrences

| File | Lines | Current | Rename to |
| --- | --- | --- | --- |
| `components/PrimitiveScene.tsx` | 53–210 | `v`, `k`, `t`, `n`, `g`, `f`, `q`, `c`, `aa` | `paramValue`, `paramName`, `scaledTime`, `noiseValue`, `grayscaleNormalized`, `fbmValue`, `quantizedValue`, `rampedColor`/`mixedColor`, `antialiasThickness` |
| `components/SearchBar.tsx` | 45–353 | `r`, `d`, `q`, `h`, `t`, `o`, `i`, `ac` | `searchResult`, `searchData`/`doc`, `normalizedQuery`, `heading`, `tag`, `isOpen`, `currentIndex`, `abortController` |
| `content/source.ts` | 69, 72 | `s`, `o` | `sectionComparison`, `orderDifference` |
| `content/nav.ts` | 28 | `r` | `resolvedNavItem` |
| `content/schema.ts` | 34 | `v` | `frontmatterData` |
| `content/search.ts` | 16, 21, 26, 34 | `p`, `h`, `c` | `page`, `heading`, `component`, `primitive` |
| `content/catalog.ts` | 24 | `s` | `segment` |
| `app/palette/PaletteView.tsx` | 82–464 | `fg`, `a` | `foregroundColor`, `auroraColor`/`accent` |
| `app/page.tsx` | 20 | `c` | `component` |
| `app/components/aurora/page.tsx` | 91, 96 | `r`, `n`, `l` | `roundedValue`, `numericValue`, `layer` |
| `components/docs/TableOfContents.tsx` | 32 | `h` | `heading` |
| `components/docs/Breadcrumbs.tsx` | 18 | `c` | `crumb` |
| `components/PropsPlayground.tsx` | 245, 258 | `opt`, `c` | `option`, `colorValue` |
| `lib/paneUtils.ts` | 8 | `btn` | `button` |
| `lib/VisualTestPause.tsx` | 15 | `p` | `policyName` |
| `app/dev/fbm-playground/FbmScene.tsx` | 54 | `t` | `fbmValue` |
| `data/recipes.ts` (display string) | 27, 92–94 | `t`, `p`, `f` | `normalizedStripe`, `samplePoint`, `fbmValue` |
| `app/recipes/_builds.ts` (display string) | 15–145 | `t`, `c`, `p`, `f` | `normalizedStripe`, `rampedColor`, `samplePoint`, `fbmValue` |

> Already clear (leave as-is): `dx`/`dy` (widely understood deltas), `entry`, `hue`,
> `step`, `components`, `pages`, and the `palette.gen.ts` loop vars.

---

## Public API catalog (breaking renames)

Per the confirmed scope: spell out shader-domain jargon and rename **all** vague props.
Where a prop's exact meaning determines the best explicit name (e.g. `focus`,
`variant`, `motion`), the table gives a recommended name but the **final name is
confirmed by reading the shader's use of that prop during execution** — don't guess.

### A. `@lovo/matter` engine exports — `packages/matter/src/index.ts`

| Line | Current | Rename to | Notes |
| --- | --- | --- | --- |
| 17–18 | `fbm`, `FBMOptions` | `fractalNoise`, `FractalNoiseOptions` | spell out acronym |
| 16 | `noise` | `simplexNoise` | it *is* simplex noise; matches the `SimplexNoise` component |
| 24 | `sdfCircle` | `signedDistanceFieldCircle` | spell out `sdf` |
| 30 | `time` | `elapsedTime` | clarify which "time" |
| 10 | `Vec2` (type) | `Vector2` | match three.js convention |
| 13 | `TSLNode` (type) | `ShaderNode` | `TSL` is opaque; `ShaderNode` reads plainly (decide: keep `TSLNode`?) |
| 20 | `voronoi` | *keep* | already a full proper name, not an abbreviation |
| — | `colorRamp`, `quantize`, `displace`, `cursorRipple`, `filmGrain` | *keep* | already clear |

### B. `@lovo/matter-react` exports — `hooks/index.ts`, `components/index.ts`

| File | Current | Rename to | Notes |
| --- | --- | --- | --- |
| `hooks/index.ts` | `useOverlayPass` | `usePostProcessPass` | + rename paired type `OverlayTransform` → `PostProcessTransform` for consistency |
| `hooks/index.ts` | `useStaticHint` | `useStaticSceneHint` | clarify it hints a non-animating scene |
| `components/index.ts` | `MonitorAnchor` | `ShaderMonitorAnchor` | discoverability + matches `ShaderMonitor` |
| — | `AnimatableProp`, `AnimatableSignal`, `CursorSignal`, `ResizeSignal`, `ScrollSignal`, `ShaderScene`, `ShaderMonitor`, `FallbackBoundary` | *keep* | already clear |

### C. `@lovo/matter-cli` flags + config — `src/index.ts`, `src/config/matterConfig.ts`

| Line | Current | Rename to | Notes |
| --- | --- | --- | --- |
| index 37/53/72 | `--ref` | `--reference` | spell out (alias `--ref` optional for git muscle-memory) |
| index 89 | `--from` | `--source` | clarify it's the source component file |
| index 90 | `--out` | `--output` | CLI full-word convention |
| index 91 | `--type <format>` | `--format` | it selects image format (png/jpg) |
| index 93 | `--export <name>` | `--export-name` | reads as a noun, not a verb |
| index 94 | `--time <seconds>` | `--capture-delay` | clarify: settle time after first non-blank frame |
| config 10 | `tsx` (key) | `useTypeScript` | boolean — opaque acronym; updates `init` writer + schema + validate |
| — | `--registry`, `--quality`, `--width`, `--height`, `--force`; keys `componentsDir`, `registryUrl`, `aliases` | *keep* | already clear |

### D. `registry/` component props — apply the "longer only if clearer" test

The existing prop names were chosen deliberately to convey intent. The rule here:
**rename only when the new name adds real meaning** (resolves "X of what?") or fixes a
cross-component inconsistency. Reject renames that are merely longer, and never rename
to a *presumed* behavior — a confidently-wrong name is worse than a terse-but-right one.

**D1 — Keep (already intent-clear; a longer name adds nothing or risks being wrong):**

| Component | Prop | Why keep |
| --- | --- | --- |
| Aurora | `densityX`, `densityY` | already reads as "band density per axis"; `noiseDensity…` adds no meaning |
| MeshGradient | `paletteA`, `paletteB` | two *equal* palettes it cycles between; `primary`/`secondary` invents a false hierarchy |
| MeshGradient | `cycleEase` | clear; `cycleEasing` is a wash |
| Waves | `glow` | a 0–1 `glow` is already an intensity; `glowIntensity` is redundant |
| DotField | `inputs` | conveys "external signal inputs"; `signals` is a lateral move |
| all | `colors`, `stops`, `angle`, `speed`, `frequency`, `amplitude`, `intensity`, `softness`, `radius`, `center`, `thickness`, `baseline`, `spacing`, `dotSize`, `reach`, `focalPoint`, `interactive`, `color` | already clear |

**D2 — Rename (clear win: fixes a cross-component inconsistency):**

| Component | Prop | Rename to | Why |
| --- | --- | --- | --- |
| Aurora | `hex` (`AuroraLayer`) | `color` | swaps a *format* name for a *role* name; every other component uses `color` |

**D3 — Genuinely vague: resolved against the shader (evidence-based):**

| Component | Prop | Decision | Evidence in shader |
| --- | --- | --- | --- |
| SimplexNoise | `focus` | → **`contrast`** | scales the noise around 0.5 — `>1` pushes values to the ramp extremes, `<1` toward the middle (that's contrast) |
| SimplexNoise | `variant` | → **`seed`** | becomes an XY offset added to the noise sample coords — it reseeds the pattern |
| Aurora | `variation` (`AuroraLayer`) | → **`seed`** | fed into the per-layer noise `warpSeed` to differentiate each layer's pattern — **not** a color knob (earlier `colorVariation` guess was wrong) |
| FilmGrain | `mode` | → **`grainBlend`** | enum is `additive`\|`subtractive` — it's how the grain blends with the input. **Not** `blendMode`: those values aren't standard blend-mode keywords (`screen`/`multiply`/…) and `subtractive` is a grain-specific darken-only pass, not the textbook Subtract blend. Reserve `blendMode` for a future general blend-mode API. |
| Waves | `motion` (`WaveLayer`) | → **`turbulence`** | scales a secondary high-frequency, counter-traveling ripple mixed into the base wave — adds agitation/complexity, **not** drift. `chop`/`choppiness` is the accurate water-shader term but is jargon for a web-dev audience; `turbulence` reads plainly. `motion` was actively misleading (collides with `speed`, the real temporal control). |
| DotField | `strength` | → **`displacementStrength`** *(low priority)* | scales how far dots displace from the cursor; accurate, but `strength` reads fine next to `reach` — optional |

> The shader read caught **two wrong guesses**: Aurora `variation` is a noise *seed*
> (not `colorVariation`), and Waves `motion` is wave *turbulence* (a secondary ripple,
> not `drift`). Bonus: `variant` and `variation` both resolving to `seed` gives
> cross-component consistency. Net result — the only props that change are the **one
> consistency fix (D2)** plus these **five verified D3 renames** (DotField `strength`
> optional); everything in D1 keeps its original, already-clear name.

### E. Cross-surface consistency fixes

- **Single-color prop:** standardize on `color`. Only `AuroraLayer.hex` breaks the
  pattern → rename to `color` (Vignette, Waves, DotField already use `color`).
- **Motion vs speed:** `WaveLayer.motion` is the only per-layer "motion" term while
  every component uses `speed` for animation rate. Resolved in the shader (D3): it
  scales a secondary ripple (agitation), distinct from `speed` — renamed to
  **`turbulence`**.
- **`…U` uniform suffix** also appears on the *internal* shader-prop interfaces
  (`speedU`, `dot-field.tsx` `spacingU`/`cursorU`/`resU`) — covered by Phase 4a.

---

## Execution plan

Phased to match the project's "small phases, stop-and-play validation" preference.
Each phase is independently committable and ends at a green gate. Run between phases:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

For registry/docs visual changes also run the Playwright visual suite where relevant
(`pnpm --filter docs-tests test`) and eyeball the docs site — renames must be pure
no-ops at runtime (identical pixels).

### Method (all phases)

- Prefer **editor rename-symbol** (language-server rename) so every reference, import,
  and type position updates atomically. Fall back to careful scoped find/replace only
  for purely-local identifiers that rename-symbol can't reach.
- Renames are **behavior-preserving**: no logic changes, no signature/order changes
  (except local variable identifiers). **Phases 1–5 are pure internal no-ops**
  (invisible to consumers). **Phases 6–9 are deliberate breaking public-API renames**
  (exports, hooks, props, CLI flags, config keys) — acceptable pre-release.
- One file (or one tight cluster) per commit where practical; commit message
  `refactor(<scope>): clarify variable names in <area>`.
- Keep an eye on shader correctness gotchas (CLAUDE.md #12, #17): renames must not
  restructure TSL expression chains — only the binding name changes.

### Phase 1 — `packages/matter` (engine)

- Files: `cursor-input.ts`, `fbm.ts`, `color-ramp.ts`, `quantize.ts`,
  `create-renderer.ts`, `reduced-motion.ts`, `intersection.ts`, `visibility.ts` and
  their tests.
- Apply canonical mappings (`cb`→`listener`, `subs`→`subscriptions`, `obs`→`observer`,
  `mql`→`mediaQueryList`, `w`/`h`→`canvasWidth`/`canvasHeight`, etc.).
- **Gate:** `pnpm --filter @lovo/matter typecheck && … test`. This package has real
  unit tests — they must stay green and prove the renames are pure.

### Phase 2 — `packages/matter-react` (binding)

- Files: all hooks (`use-resize`, `use-cursor`, `use-scroll`, `use-animatable-uniform`,
  `use-overlay-pass`, `use-static-hint`, `use-shader-material`), `shader-monitor`,
  `shader-scene`, `internal/create-signal.ts` and tests.
- Standardize `ctx`→`shaderContext`/`shaderContextValue`, `cb`→`changeCallback`/
  `listener`, `raf`→`animationFrameId`, `client`→`tickHandler`/`schedulerTickHandler`.
- **Gate:** typecheck + test for the package. Watch Strict-Mode lifecycle hooks
  (`use-cursor`, CLAUDE.md #14) — names only, no lifecycle edits.

### Phase 3 — `packages/matter-cli`

- Files: `commands/*`, `transforms/rewriteImports.ts`, `poster/*`, `config/validate.ts`,
  `registry/fetchRegistry.ts`, `harness/index.tsx` and tests.
- `cfg`→`matterConfig` is the dominant mapping; plus `req`/`res`, `idx`, type-guard
  `x`/`v`→`value`.
- **Gate:** typecheck + test, then `pnpm smoke` (end-to-end CLI smoke in a temp project)
  to confirm the copy/transform pipeline still works.

### Phase 4 — `registry/` (shader components)

- Files: `utils/color.ts`, `dot-field.tsx`, and every `shader.tsx`/component wrapper
  (`linear-gradient`, `mesh-gradient`, `simplex-noise`, `vignette`, `waves`, `aurora`,
  `film-grain`).
- Two sub-passes for safety:
  - **4a — uniform suffix:** `…U` → `…Uniform` across all shaders.
  - **4b — math & color locals:** RGB channels, canvas dims, `p`/`t`/`n` →
    `samplePosition`/`scaledTime`/`noiseValue`, palette `a0…b3` → descriptive names.
- **Gate:** typecheck + build, then run the docs site and the Playwright visual suite
  (`apps/docs-tests`). Snapshots must match exactly — any diff means a rename
  accidentally changed a TSL chain. This is the highest-risk phase; go slow, one
  component per commit, eyeball each in the browser ("stop and play").

### Phase 5 — `apps/docs`

- Files: `PrimitiveScene.tsx`, `SearchBar.tsx`, `content/*`, `PaletteView.tsx`,
  `app/page.tsx`, doc components, `PropsPlayground.tsx`, `paneUtils.ts`,
  `VisualTestPause.tsx`, `FbmScene.tsx`.
- **5b — display strings:** `data/recipes.ts` and `app/recipes/_builds.ts` snippet
  variables. These change user-visible docs text, so review the rendered recipe pages
  after editing.
- **Gate:** typecheck + lint + `next build`, run the docs site, re-run the docs-tests
  visual + a11y suites. Update any visual snapshots that legitimately change **only**
  where a renamed display-string snippet is rendered as text.

> **Phases 6–9 below are breaking public-API changes.** Do them after the internal
> no-op phases land. Each public phase must also update every downstream touchpoint:
> docs pages/demos, the Tweakpane `PropsPlayground` schemas, poster example files,
> `apps/docs-tests` specs, component READMEs, and `registry.json` if a slug changes
> (slugs are *not* being renamed here — only identifiers/props/flags).

### Phase 6 — `@lovo/matter` public exports

- Apply catalog **A**: `fbm`/`FBMOptions`, `noise`, `sdfCircle`, `time`, `Vec2`,
  (decision) `TSLNode`. Use rename-symbol so all internal call sites + dependent
  packages (`matter-react`, `registry`, `apps/docs`) update.
- **Gate:** monorepo typecheck + all package tests + `pnpm build`. Add a CHANGELOG
  entry per package documenting the renamed exports.

### Phase 7 — `@lovo/matter-react` public exports

- Apply catalog **B**: `useOverlayPass`/`OverlayTransform`, `useStaticHint`,
  `MonitorAnchor`. Update docs usage and any registry components that consume them.
- **Gate:** typecheck + tests + `next build` for docs; CHANGELOG entry.

### Phase 8 — `@lovo/matter-cli` flags + config key

- Apply catalog **C**: rename flags (`--reference`, `--source`, `--output`,
  `--format`, `--export-name`, `--capture-delay`) and config key `tsx` →
  `useTypeScript` (update the schema, `validate.ts`, the `init` writer, default
  config, and all tests). Update CLI README/help examples.
- **Gate:** typecheck + tests + `pnpm smoke`. CHANGELOG entry. Note the config-key
  break for anyone with an existing `matter.config.json` (acceptable pre-release; a
  one-line back-compat alias for `tsx` is optional).

### Phase 9 — `registry/` component props

- Small, resolved scope: **D1 untouched**; **D2** = `AuroraLayer.hex` → `color`;
  **D3** = `focus`→`contrast`, SimplexNoise `variant`→`seed`, Aurora `variation`→`seed`,
  FilmGrain `mode`→`grainBlend`, Waves `motion`→`turbulence` (DotField `strength`→
  `displacementStrength` optional). Names are already verified against each shader.
- One component per commit. Update: the component `.tsx` + `shader.tsx`, default-props
  objects, the docs page + demo, the `PropsPlayground` schema, poster examples, and the
  visual/a11y specs.
- **Gate (per component):** typecheck + build, run the docs site, run the Playwright
  visual suite. Renames must be pixel-identical no-ops at runtime — only the prop
  *name* changes. CHANGELOG entry listing the prop renames (most user-visible break
  for copy-paste consumers).

### Phase 10 — guardrail (optional, recommended)

- Add an ESLint `id-length`/`id-denylist` rule (or a custom rule) to the shared
  `tooling/eslint-config` to prevent regressions (deny `cb`, `ctx`, `cfg`, `tmp`,
  single-letter locals outside a small allowlist like loop-free math if desired).
- **Gate:** `pnpm lint` clean across the monorepo; tune the allowlist so it doesn't
  fight legitimate cases.

## Risks & notes

- **Highest risk: registry shaders.** TSL is sensitive to how expression chains are
  built (CLAUDE.md #12). A rename must never merge/split a chain — only swap the
  identifier. Visual-regression snapshots are the safety net; run them per component.
- **Public API renames are breaking (Phases 6–9).** Acceptable pre-release, but they
  ripple into docs, the Tweakpane playground, poster examples, visual tests, and
  READMEs — each public rename must update those in the same commit, with a CHANGELOG
  entry. Keep these phases *after* the internal no-op phases so the safe cleanup isn't
  blocked on API decisions.
- **Registry prop renames hit copy-paste consumers hardest.** A user who already ran
  `matter add aurora` has a local copy using the old prop names; `matter update` will
  overwrite with the new names. Call this out in the CHANGELOG / release notes.
- **Intent-dependent prop names** (`focus`, `variant`, `motion`, `densityX/Y`,
  `strength`, `inputs`) must be confirmed against the shader before finalizing — the
  recommended names in catalog D are starting points, not gospel.
- **`dx`/`dy`, `hue`, `step`, `entry`** and similar already-clear short names are left
  untouched intentionally.
- **Rename-symbol first.** It updates references safely; raw find/replace risks
  clobbering same-named identifiers in unrelated scopes.
