// Per-recipe TSL build callbacks. Each function returns the colorNode for a
// MeshBasicNodeMaterial — RecipeViewer wires them into a fullscreen plane.
//
// IMPORTANT — gotcha #12 (CLAUDE.md): TSL chains MUST be rooted on a TSL-built
// node (uv(), time, vec2(...), etc.) and pass uniforms only as method
// arguments. `cursorUniform.sub(...)` silently produces wrong GPU values even
// though it typechecks. Pre-commit grep should find zero matches of
// `Uniform.<mathFn>(`.
//
// Each build's TSL is hand-translated from the corresponding `source` string
// in `_data/recipes.ts`. When you change one, change the other; they are
// conceptually equivalent — the source is what the user pastes, the build is
// what we render live for the preview.

import {
  uv,
  time,
  vec2,
  vec3,
  vec4,
  sin,
  length,
  smoothstep,
  fbm,
  voronoi,
  quantize,
  colorRamp,
  type ColorRampStop,
} from '@lovo/matter'
import type { uniform } from '@lovo/matter'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export type RecipeBuild = (deps: {
  cursorUniform: ReturnType<typeof uniform>
}) => ShaderNodeObject<Node>

export const RECIPE_BUILDS: Record<string, RecipeBuild> = {
  // sin(uv.x * 20 + time * 2) → 0..1 → 2-stop colorRamp.
  // Chain root: uv() (for uv().x) and time. No uniform receivers.
  // time multiplier 2 means one full stripe cycle every ~3.1s — visibly
  // animated. (Earlier value of 0.5 took ~12.6s per cycle, which read as
  // static at a glance.)
  'animated-stripes': () => {
    const tNode = (time as ShaderNodeObject<Node>).mul(2)
    // uv().x is a swizzle on a TSL-built node — safe receiver.
    const phase = (uv() as ShaderNodeObject<Node>).x.mul(20).add(tNode) as ShaderNodeObject<Node>
    const stripe = sin(phase as never) as ShaderNodeObject<Node>
    // sin → [-1, 1] → [0, 1].
    const t = stripe.mul(0.5).add(0.5).clamp(0, 1) as ShaderNodeObject<Node>
    const stops: ColorRampStop[] = [
      { color: vec3(1, 0.5, 0.4), position: 0 },
      { color: vec3(0.4, 0.6, 1), position: 1 },
    ]
    const c = colorRamp(t as never, stops) as ShaderNodeObject<Node>
    return vec4(c as never, 1) as never
  },

  // length(uv() - cursor) → smoothstep → tinted glow.
  // Chain root: uv(). cursorUniform appears ONLY as an arg to .sub() — the
  // canonical gotcha-#12-safe pattern from registry/aurora.tsx.
  'cursor-glow': ({ cursorUniform }) => {
    const offset = (uv() as ShaderNodeObject<Node>).sub(cursorUniform as never) as ShaderNodeObject<Node>
    const dist = length(offset as never) as ShaderNodeObject<Node>
    // smoothstep(0.3, 0, dist): 1 at the cursor, 0 at uv-distance >= 0.3.
    // The reversed edges (0.3 → 0) produce a center-bright falloff.
    const glow = smoothstep(0.3, 0, dist as never) as ShaderNodeObject<Node>
    // Slight color shift: red≈glow, green≈glow*0.7, blue≈glow*1.5 (clamped
    // implicitly by the framebuffer — gives the glow a cool blue tint at
    // peak intensity and warmer falloff toward zero).
    return vec4(
      glow,
      glow.mul(0.7) as ShaderNodeObject<Node>,
      glow.mul(1.5) as ShaderNodeObject<Node>,
      1,
    ) as never
  },

  // fbm(uv * 2 + vec2(t, t)) → 0..1 → 3-stop "plasma" colorRamp.
  // Chain root: uv() / time / vec2(...). No cursor.
  plasma: () => {
    const t = (time as ShaderNodeObject<Node>).mul(0.3)
    const p = (uv() as ShaderNodeObject<Node>).mul(2).add(vec2(t, t)) as ShaderNodeObject<Node>
    // fbm returns ~[-1, 1]; map to [0, 1] for the ramp.
    const f = (fbm(p, { octaves: 4 }) as ShaderNodeObject<Node>)
      .mul(0.5)
      .add(0.5)
      .clamp(0, 1) as ShaderNodeObject<Node>
    const stops: ColorRampStop[] = [
      { color: vec3(0.4, 0, 0.8), position: 0 },
      { color: vec3(1, 0.4, 0.6), position: 0.5 },
      { color: vec3(0.4, 0.9, 1), position: 1 },
    ]
    const c = colorRamp(f as never, stops) as ShaderNodeObject<Node>
    return vec4(c as never, 1) as never
  },

  // voronoi(uv * 8) → quantize into 4 bins → desaturated palette.
  // Chain root: uv(). No cursor, no time — the pattern is static.
  'cellular-tiles': () => {
    const p = (uv() as ShaderNodeObject<Node>).mul(8) as ShaderNodeObject<Node>
    const cells = voronoi(p) as ShaderNodeObject<Node>
    // quantize bins the [0, 1] cell distance into 4 discrete steps.
    const tiered = quantize(cells as never, 4) as ShaderNodeObject<Node>
    return vec4(
      tiered,
      tiered.mul(0.7) as ShaderNodeObject<Node>,
      tiered.mul(0.5) as ShaderNodeObject<Node>,
      1,
    ) as never
  },
}
