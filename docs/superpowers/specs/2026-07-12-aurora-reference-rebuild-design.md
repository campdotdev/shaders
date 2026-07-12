# Aurora reference rebuild (MAT-48) — design

**Date:** 2026-07-12
**Status:** Approved (brainstorm session 2026-07-11/12)
**Branch:** `hunter/mat-48-rework-aurora`

## Goal

Rebuild `registry/aurora/shader.tsx` from scratch as a faithful port of the
nimitz-style ShaderToy aurora the user supplied (see Appendix A), then
productize it back into a Matter Tier 1 component. The MAT-46 shader is
discarded — it shares ancestry with the same reference but diverged in the
places that make the reference look alive.

### Why redo it

Diagnosed gaps in the current (MAT-46) aurora versus the reference:

1. **Color is flat.** Reference colors each raymarch slice by *slice index*
   through a cycling sin palette, so ribbons at different depths glow
   different hues. Current version ramps color by altitude only — every
   ribbon carries the same vertical gradient.
2. **Banding.** Current sin-dot hash plus 40 steps plus a hard 0.55 field
   clamp produce visible slice/contour banding. Reference uses a
   fract-dot hash, 60 steps, and ramped per-pixel jitter.
3. **Motion.** Reference rotates the whole fbm domain a little every octave
   (`p *= mm2(time * 0.01)`), giving smooth continuous evolution. Current
   version uses a static rotation.
4. **Prop bloat.** `drift` and `direction` (né `horizon`) no longer earn
   their place. `falloff` was doing something its name didn't say.

## Decisions (from brainstorm)

| Question | Decision |
| --- | --- |
| Keep user color control? | Yes — `stops` ramp stays, but indexed on **slice depth**, not altitude |
| Ramp wraps (cycles) or runs once across depth? | Deferred to Phase 4 gate — one-line toggle, decide by eye |
| Prop roster | `stops`, `intensity`, `speed`, `turbulence`, `density`, `falloff`, `colorSpace`, `hueInterpolation` |
| Dropped props | `drift`, `direction` — breaking change, noted in changelog |
| `falloff` semantics | Horizon fade steepness. High = tight fade at band bottom; 0 = no cut, aurora fills canvas. Fade must stay soft and ride the ribbon shapes — never read as a screen-space line |
| Background | Component stays a transparent premultiplied overlay. Reference's sky gradient lives only on the demo page as a page background |
| Build strategy | Faithful-first, two-stage: port the reference verbatim (opaque, sin palette, literal constants), A/B against ShaderToy, then productize one gate at a time |
| Execution mode | Co-write: the user types `shader.tsx` chunk-by-chunk; Claude explains and guides, and does not Edit/Write shader files |

## Public API

Files keep their current shape: `registry/aurora/aurora.tsx` (wrapper with
destructured defaults) + `registry/aurora/shader.tsx` (TSL, rewritten from
empty). Demo page and Tweakpane panel updated to match.

```ts
export interface AuroraProps {
  stops?: ColorStop[];                 // depth-indexed color ramp, brand-palette default
  intensity?: AnimatableProp<number>;  // output gain
  speed?: AnimatableProp<number>;      // time multiplier (warp rotation + per-octave rotation)
  turbulence?: AnimatableProp<number>; // warp strength, multiplier around reference's dg * 0.75
  density?: AnimatableProp<number>;    // field gain, multiplier around reference's rz * 20
  falloff?: AnimatableProp<number>;    // horizon fade steepness; 0 = fills canvas
  colorSpace?: ColorSpace;             // ramp mixing space, default 'oklab'
  hueInterpolation?: HueInterpolation; // default 'shorter'
}
```

Every numeric prop is a multiplier (or normalized dial) around the reference
literal so that the default value reproduces the reference feel.

## Shader structure

### Stage 1 — faithful port (opaque)

Five co-write blocks mirroring the reference function-for-function:

1. **Helpers.**
   - `hashNoise(vec2)` — the reference's fract-dot hash (replaces the old
     sin-dot hash; half of the banding fix).
   - `rotate2d(angle)` — the reference's `mm2`, via TSL `mat2`.
   - `triangleWave(x)` = `abs(fract(x) - 0.5)`; `triangleWave2(p)` the vec2
     composite.
2. **`auroraField(p, warpSpeed)`** — 5-octave triangle-noise fbm:
   - initial domain bend `p *= rotate2d(p.x * 0.06)`;
   - per octave: warp offset `dg = triangleWave2(bp * 1.85) * 0.75` rotated
     by `time * warpSpeed`, applied `p -= dg / z2`; lacunarity/gain ladder
     (`bp *= 1.3`, `z2 *= 0.45`, `z *= 0.42`, `p *= 1.21 + (rz - 1) * 0.02`);
     ridge accumulation `rz += tri(p.x + tri(p.y)) * z`; and the whole-domain
     rotation `p *= rotate2d(time * 0.01)` (the smooth-motion ingredient).
   - output `clamp(1 / pow(rz * 20, 1.3), 0, 1)`.
   - Written as an unrolled JS `for` loop — 5 fixed iterations, compile-time.
3. **Raymarch** — 60 slices via TSL `Loop`, running `avgColor`/`accumColor`
   vec4 accumulators:
   - per-pixel jitter `0.006 * hashNoise(screenCoordinate) * smoothstep(0, 15, i)`
     subtracted from slice distance (other half of the banding fix; the
     scene-wide Bayer dither then swallows the residue);
   - slice distance `pt = (0.8 + pow(i, 1.4) * 0.002) / (rd.y * 2 + 0.4)`;
   - sample point `bpos = 5.5 + pt * rd`, field sampled on `bpos.zx`;
   - slice color `sin(1 - vec3(2.15, -0.5, 1.2) + i * 0.043) * 0.5 + 0.5`,
     scaled by the field value;
   - `avg = mix(avg, sliceColor, 0.5)`;
     `accum += avg * exp2(-i * 0.065 - 2.5) * smoothstep(0, 5, i)`.
   - post-loop: `accum *= clamp(rd.y * 15 + 0.4, 0, 1)` (the falloff seed).
4. **Ray setup** — `rd = normalize(vec3(ndc.xy, 1.064))` with the aspect
   correction pattern from the current shader so wide canvases don't stretch.
5. **Stage-1-only output** — opaque composite exactly like the reference:
   sky gradient `mix(vec3(0.006, 0.026, 0.095), vec3(0.007, 0.011, 0.035), uv.y)`
   plus aurora RGB, then `smoothstep(0, 1.1, pow(col, 1) * 1.5)` shaping.
   Gamma handling adapted to our pipeline: the reference hand-rolls
   `pow(col, 1/2.2)` because ShaderToy outputs raw; in Matter the
   working→output transform belongs to the scene's output pass, so the port
   must not double-encode. Exists solely to A/B against ShaderToy; deleted in
   stage 2.

All constants stay literal in stage 1 — no uniforms, no props.

### Stage 2 — productize

1. **Transparency swap.** Delete the sky mix. Output aurora RGB with
   luminance-derived alpha, `material.premultipliedAlpha = true` (MAT-45
   lesson: straight-vs-premultiplied double-multiply kills vibrancy).
   Reference shaping (`smoothstep(0, 1.1, col * 1.5)`) applies to RGB before
   alpha derivation. Demo page paints the dark sky gradient as its own
   background so the A/B still reads.
2. **Slice-indexed color ramp.** Replace the sin palette with
   `colorRamp(sliceProgress, stops)` mixed in `colorSpace`/`hueInterpolation`.
   `sliceProgress` = normalized slice index; wrap-vs-once decided at this
   gate (`fract(i * freq)` vs `i / 60`). Default stops chosen from the brand
   OKLCH palette to mimic the reference's green→teal→purple stratification.
   Gotcha #17 caveat: `colorRamp` bakes stop literals, so `stops` changes
   rebuild the material — acceptable, same as every other ramp component.
3. **Props → uniforms.** `intensity`, `speed`, `turbulence`, `density`,
   `falloff` flow through stable `uniform(...)` nodes (gotcha #17 pattern —
   no material rebuild on Tweakpane drag). Falloff maps to the
   `clamp(rd.y * k + 0.4)` steepness plus whatever soft shaping the gate
   demands to keep the bottom edge organic.
4. **Wrapper + demo + Tweakpane.** New `AuroraProps` with destructured
   defaults, drift/direction rows removed from the panel, color bindings via
   color-plus with oklch()-format initial values (standing preference).
   Defaults tuned by eye at the final gate.

## Phases (each ends runnable, gate after every one)

| # | Phase | Gate |
| --- | --- | --- |
| 1 | Helpers + `auroraField` visualized flat (grayscale plane) | See curtain filaments, feel warp motion; tri-noise fbm + domain warp explained |
| 2 | Ray setup + 60-slice march + sin palette + sky (full reference output) | Browser vs ShaderToy side-by-side; banding check |
| 3 | Transparency swap | Same vibrancy over demo background; stacks over other shaders |
| 4 | Slice-indexed color ramp | Wrap-vs-once decision; default stops picked |
| 5 | Props → uniforms + falloff shaping | Drag every dial; falloff edge organic at extremes |
| 6 | Wrapper + demo + Tweakpane + tuned defaults | Final play/tune; ship prep |

## Verification

- No unit tests for the visual (project convention — no meaningful unit test
  for "does this aurora look right").
- Playwright visual baselines are invalidated; regenerate at the end via
  `pnpm snap` on Node 22 in Docker.
- Deterministic shader start (MAT-41) must keep working — same time-uniform
  pattern as the rest of the registry.
- Registry sources are transpiled by the docs site (`transpilePackages`), so
  shader edits hot-reload; only engine (`@lovo/matter*`) edits would need a
  `pnpm --filter` rebuild (none expected).
- CI: `pnpm format:check` before push; lockfile committed if deps change
  (none expected); all work on the PR branch, never main.

## Out of scope

- Horizon variance / per-ribbon vibrancy experiments (the aurora-organic
  seed) — this rebuild replaces that direction; revisit only if the finished
  port still wants it.
- New engine primitives. Everything lives in `registry/aurora/`.
- Any other component.

## Appendix A — reference shader (user-supplied, ShaderToy)

```glsl
#define MAX_DIST 100.0
#define PI 3.1415926535

#define u_time iTime
#define u_resolution iResolution

float random(vec2 p)
{
    vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}
float tri(in float x){return abs(fract(x)-.5);}
vec2 tri2(in vec2 p){return vec2(tri(p.x)+tri(p.y),tri(p.y+tri(p.x)));}

float fbmAurora(vec2 p, float spd) {
    float z = 1.8;
    float z2 = 2.5;
    float rz = 0.;
    p *= mm2(p.x * 0.06);
    vec2 bp = p;
    for (float i = 0.; i < 5.; i++ ) {
        vec2 dg = tri2(bp*1.85)*.75;
        dg *= mm2(u_time*spd);
        p -= dg/z2;

        bp *= 1.3;
        z2 *= .45;
        z *= .42;
        p *= 1.21 + (rz-1.0)*.02;

        rz += tri(p.x+tri(p.y))*z;
        p *= mm2(u_time * 0.01); // Smoother rotation
    }
    return clamp(1. / pow(rz * 20., 1.3), 0.,1.);
}

vec4 aurora(vec3 rd) {
    vec4 col = vec4(0);
    vec4 avgCol = vec4(0);

    for (float i=0.; i < 60.; i++) { // Increased sample count for smoother result
        float of = 0.006*random(gl_FragCoord.xy)*smoothstep(0.,15., i);
        float pt = ((.8+pow(i,1.4)*.002)) / (rd.y * 2. + 0.4);
        pt -= of;
        vec3 bpos = 5.5 + pt * rd;
        vec2 p = bpos.zx;
        float rzt = fbmAurora(p, 0.02); // Reduced speed for smoother movement
        vec4 col2 = vec4(0,0,0, rzt);
        col2.rgb = (sin(1.-vec3(2.15,-.5, 1.2) +i * 0.043) * 0.5 + 0.5)*rzt;
        avgCol = mix(avgCol, col2, .5);
        col += avgCol * exp2(-i*0.065 - 2.5) * smoothstep(0., 5., i);
    }
    col *= (clamp(rd.y*15.+.4,0.,1.));

    return smoothstep(0.,1.1,pow(col,vec4(1.))*1.5);
}

void setSkyColor(vec2 uv, out vec3 color, vec3 dir) {
   color = mix(vec3(0.006,0.026,0.095), vec3(0.007,0.011,0.035), uv.y);
   color += aurora(dir).rgb;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
  vec2 uv = fragCoord.xy / u_resolution.xy;
  vec2 p = (-u_resolution.xy + 2.0 * gl_FragCoord.xy) / u_resolution.y;

  vec3 ro = vec3(0.0, 1.2, 0.0);
  vec3 rd = normalize(vec3(p.xy, 1.064));

  vec3 color = vec3(0.0);
  setSkyColor(uv, color, rd);

  color = pow(color, vec3(1. / 2.2)); // gamma correction
  color = smoothstep(0., 1., color);

  fragColor = vec4(color, 1.0);
}
```
