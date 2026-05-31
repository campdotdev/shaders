// Per-recipe TSL build callbacks. Each function returns the colorNode for a
// MeshBasicNodeMaterial — RecipeViewer wires them into a fullscreen plane.
//
// Keys are composite: '<recipe-slug>.<variant-key>'. Each recipe has 2-3
// variants showing the same pattern at different parameterizations. The
// FIRST variant per recipe is "canonical" — its TSL matches the `source`
// string in `src/data/recipes.ts` verbatim. Subsequent variants are described
// in the recipe's `variants[i].note` so a reader can mentally reconstruct
// each variant from the canonical source + the note.
//
// IMPORTANT — gotcha #12 (CLAUDE.md): TSL chains MUST be rooted on a TSL-built
// node (uv(), time, vec2(...), etc.) and pass uniforms only as method
// arguments. `cursorUniform.sub(...)` silently produces wrong GPU values even
// though it typechecks. Pre-commit grep should find zero matches of
// `Uniform.<mathFn>(`.
//
// Cursor swizzles (`cursorUniform.x`, `cursorUniform.y`) are component
// accesses, NOT chain receivers — they unwrap to a node value the GPU treats
// as a scalar argument. The cursor-glow.square variant uses them as
// arguments inside `uv().x.sub(...)` chains, which is uv-rooted and safe.

import { colorRamp, type ColorRampStop, fbm, quantize, time, voronoi } from '@lovo/matter'
import { length, max, sin, smoothstep, uv, vec2, vec3, vec4 } from 'three/tsl'
import type { uniform } from 'three/tsl'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export type RecipeBuild = (deps: {
  cursorUniform: ReturnType<typeof uniform>
}) => ShaderNodeObject<Node>

export const RECIPE_BUILDS: Record<string, RecipeBuild> = {
  // ─── animated-stripes ─────────────────────────────────────────────────
  // Canonical: sin(uv.x * 20 + time * 2) → 0..1 → 2-stop colorRamp.
  // Chain root: uv() (for uv().x) and time. No uniform receivers.
  // time multiplier 2 means one full stripe cycle every ~3.1s — visibly
  // animated. (Earlier value of 0.5 took ~12.6s per cycle, which read as
  // static at a glance.)
  'animated-stripes.canonical': () => {
    const tNode = time.mul(2)
    const phase = (uv() as ShaderNodeObject<Node>).x.mul(20).add(tNode) as ShaderNodeObject<Node>
    const stripe = sin(phase) as ShaderNodeObject<Node>
    const t = stripe.mul(0.5).add(0.5).clamp(0, 1) as ShaderNodeObject<Node>
    const stops: ColorRampStop[] = [
      { color: vec3(1, 0.5, 0.4), position: 0 },
      { color: vec3(0.4, 0.6, 1), position: 1 },
    ]
    const c = colorRamp(t, stops)

    return vec4(c, 1)
  },

  // Diagonal: add uv.y * 8 to the phase so stripes scroll diagonally.
  // Same uv-rooted chain pattern; just one extra .add().
  'animated-stripes.diagonal': () => {
    const tNode = time.mul(2)
    const yPhase = (uv() as ShaderNodeObject<Node>).y.mul(8) as ShaderNodeObject<Node>
    const phase = (uv() as ShaderNodeObject<Node>).x
      .mul(20)
      .add(yPhase)
      .add(tNode) as ShaderNodeObject<Node>
    const stripe = sin(phase) as ShaderNodeObject<Node>
    const t = stripe.mul(0.5).add(0.5).clamp(0, 1) as ShaderNodeObject<Node>
    const stops: ColorRampStop[] = [
      { color: vec3(1, 0.5, 0.4), position: 0 },
      { color: vec3(0.4, 0.6, 1), position: 1 },
    ]
    const c = colorRamp(t, stops)

    return vec4(c, 1)
  },

  // Pulse: replace time.mul(2) with sin(time).mul(2). The phase advances
  // back-and-forth so colors breathe rather than scroll. Fewer stripes
  // (8 instead of 20) makes the pulse rhythm easier to read.
  'animated-stripes.pulse': () => {
    const tNode = sin(time).mul(2) as ShaderNodeObject<Node>
    const phase = (uv() as ShaderNodeObject<Node>).x.mul(8).add(tNode) as ShaderNodeObject<Node>
    const stripe = sin(phase) as ShaderNodeObject<Node>
    const t = stripe.mul(0.5).add(0.5).clamp(0, 1) as ShaderNodeObject<Node>
    const stops: ColorRampStop[] = [
      { color: vec3(1, 0.5, 0.4), position: 0 },
      { color: vec3(0.4, 0.6, 1), position: 1 },
    ]
    const c = colorRamp(t, stops)

    return vec4(c, 1)
  },

  // ─── cursor-glow ──────────────────────────────────────────────────────
  // Circular (canonical): length(uv() - cursor) → smoothstep → tinted glow.
  // Chain root: uv(). cursorUniform appears ONLY as an arg to .sub() — the
  // canonical gotcha-#12-safe pattern from registry/aurora.tsx.
  'cursor-glow.circular': ({ cursorUniform }) => {
    const offset = (uv() as ShaderNodeObject<Node>).sub(cursorUniform) as ShaderNodeObject<Node>
    const dist = length(offset) as ShaderNodeObject<Node>
    const glow = smoothstep(0.3, 0, dist) as ShaderNodeObject<Node>

    return vec4(glow, glow.mul(0.7), glow.mul(1.5), 1)
  },

  // Square: replace euclidean length with Chebyshev distance —
  // max(|uv.x - cursor.x|, |uv.y - cursor.y|). This produces a square
  // (axis-aligned) falloff instead of circular.
  //
  // gotcha #12 watch: every chain receiver here is a uv-rooted node
  // (uv().x, uv().y). cursorUniform.x and cursorUniform.y are component
  // SWIZZLES — they read a scalar out of the uniform and feed it as an
  // ARGUMENT to .sub(). They are not chain receivers. Verified by
  // matching Aurora's pattern: receiver is uv-rooted; uniform is an arg.
  //
  // The `as unknown as { x: ... }` cast is unavoidable because
  // ReturnType<typeof uniform> is `ShaderNodeObject<UniformNode<unknown>>`
  // and TS doesn't expose `.x`/`.y` swizzle on the unknown-typed inner
  // node. Runtime IS a vec2 because RecipeScene wraps a Vector2.
  'cursor-glow.square': ({ cursorUniform }) => {
    const cu = cursorUniform as unknown as {
      x: ShaderNodeObject<Node>
      y: ShaderNodeObject<Node>
    }
    const dx = (uv() as ShaderNodeObject<Node>).x.sub(cu.x).abs() as ShaderNodeObject<Node>
    const dy = (uv() as ShaderNodeObject<Node>).y.sub(cu.y).abs() as ShaderNodeObject<Node>
    const dist = max(dx, dy) as ShaderNodeObject<Node>
    const glow = smoothstep(0.3, 0, dist) as ShaderNodeObject<Node>

    return vec4(glow, glow.mul(0.7), glow.mul(1.5), 1)
  },

  // Pinpoint: tighter smoothstep edge (0.1 instead of 0.3) + uniform
  // RGB instead of the blue-tinted mix → small white dot at the cursor.
  'cursor-glow.pinpoint': ({ cursorUniform }) => {
    const offset = (uv() as ShaderNodeObject<Node>).sub(cursorUniform) as ShaderNodeObject<Node>
    const dist = length(offset) as ShaderNodeObject<Node>
    const glow = smoothstep(0.1, 0, dist) as ShaderNodeObject<Node>

    return vec4(glow, glow, glow, 1)
  },

  // ─── plasma ───────────────────────────────────────────────────────────
  // Canonical: fbm(uv * 2 + vec2(t, t)) → 0..1 → 3-stop colorRamp.
  // Chain root: uv() / time / vec2(...). No cursor.
  'plasma.canonical': () => {
    const t = time.mul(0.3)
    const p = (uv() as ShaderNodeObject<Node>).mul(2).add(vec2(t, t)) as ShaderNodeObject<Node>
    const f = fbm(p, { octaves: 4 }).mul(0.5).add(0.5).clamp(0, 1) as ShaderNodeObject<Node>
    const stops: ColorRampStop[] = [
      { color: vec3(0.4, 0, 0.8), position: 0 },
      { color: vec3(1, 0.4, 0.6), position: 0.5 },
      { color: vec3(0.4, 0.9, 1), position: 1 },
    ]
    const c = colorRamp(f, stops)

    return vec4(c, 1)
  },

  // Monochrome marble: same fbm chain, but a 2-stop dark→light ramp.
  // Reads as veined stone rather than psychedelic plasma.
  'plasma.monochrome-marble': () => {
    const t = time.mul(0.3)
    const p = (uv() as ShaderNodeObject<Node>).mul(2).add(vec2(t, t)) as ShaderNodeObject<Node>
    const f = fbm(p, { octaves: 4 }).mul(0.5).add(0.5).clamp(0, 1) as ShaderNodeObject<Node>
    const stops: ColorRampStop[] = [
      { color: vec3(0.05, 0.05, 0.1), position: 0 },
      { color: vec3(0.85, 0.85, 0.9), position: 1 },
    ]
    const c = colorRamp(f, stops)

    return vec4(c, 1)
  },

  // ─── cellular-tiles ───────────────────────────────────────────────────
  // Canonical: voronoi(uv * 8) → quantize into 4 bins → warm sepia tint.
  'cellular-tiles.canonical': () => {
    const p = (uv() as ShaderNodeObject<Node>).mul(8) as ShaderNodeObject<Node>
    const cells = voronoi(p)
    const tiered = quantize(cells, 4)

    return vec4(tiered, tiered.mul(0.7), tiered.mul(0.5), 1)
  },

  // Coarse mosaic: larger cells (uv * 4) with fewer bins (3). Cool blue-
  // white palette via straight scalar tint. Reads as chunky background.
  'cellular-tiles.coarse-mosaic': () => {
    const p = (uv() as ShaderNodeObject<Node>).mul(4) as ShaderNodeObject<Node>
    const cells = voronoi(p)
    const tiered = quantize(cells, 3)

    return vec4(tiered.mul(0.6), tiered.mul(0.7), tiered, 1)
  },

  // Fine stained glass: small cells (uv * 14), 8 bins, jewel-toned 4-stop
  // ramp. The colorRamp turns the quantized scalar into discrete jewel
  // colors instead of a single-channel tint.
  'cellular-tiles.fine-stained-glass': () => {
    const p = (uv() as ShaderNodeObject<Node>).mul(14) as ShaderNodeObject<Node>
    const cells = voronoi(p)
    const tiered = quantize(cells, 8)
    const stops: ColorRampStop[] = [
      { color: vec3(0.5, 0.05, 0.3), position: 0 }, // ruby
      { color: vec3(0.1, 0.2, 0.6), position: 0.33 }, // sapphire
      { color: vec3(0.05, 0.5, 0.4), position: 0.66 }, // emerald
      { color: vec3(0.9, 0.75, 0.2), position: 1 }, // amber
    ]
    const c = colorRamp(tiered, stops)

    return vec4(c, 1)
  },
}
