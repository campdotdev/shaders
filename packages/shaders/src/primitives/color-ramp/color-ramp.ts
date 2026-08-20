import type { ShaderNodeObject } from 'three/tsl';
import { clamp, div, greaterThan, max, select, step, sub, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { hueArcInterpolators } from '../color-space/hue.js';
import { colorSpaces } from '../color-space/registry.js';
import type { ColorSpace, HueInterpolation } from '../color-space/types.js';

/**
 * Canonical TSL-node *input* shape used throughout `@mattermix/shaders`.
 *
 * Stays as the broad `Node | ShaderNodeObject<Node>` union so callers can
 * pass uniform-typed nodes (e.g. `ShaderNodeObject<UniformNode<Vector2>>`)
 * without casting at the call site — those are subtypes of `Node` but NOT
 * subtypes of `ShaderNodeObject<Node>` due to invariant generic parameters.
 *
 * Wrappers should return the narrower `ShaderNodeObject<Node>` so the
 * **output** is always chainable without casts.
 */
export type TSLNode = Node | ShaderNodeObject<Node>;

export interface ColorRampStop {
  /** Color expressed as a TSL node (typically `vec3(r,g,b)`), in linear-sRGB.
      May be node-driven (e.g. `uniform(new Color(...))`) — the ramp then
      re-mixes on the GPU without a rebuild when the value changes. */
  color: TSLNode;
  /** Position 0..1 along the ramp — a literal number (baked into the shader)
      or a float node (e.g. `uniform(0.5)`) for live-driven ramps. */
  position: number | TSLNode;
}

/**
 * Multi-stop color interpolation. Given a t in [0..1] and N color stops at
 * fixed positions, returns the smoothly-interpolated color.
 *
 * `colorSpace` controls the interpolation space (default `'linear'` — a plain
 * per-channel mix that preserves the input values). Stops are converted into
 * the space up front, the nested-mix chain runs IN that space, and the result
 * is converted back to linear-sRGB once at the end.
 *
 * `hueInterpolation` chooses which way around the wheel cylindrical spaces
 * travel (default `'shorter'`); it's inert for rectangular spaces (linear/oklab).
 *
 * Falls back to the first/last stop's color outside the bracketing positions.
 *
 * Stops may be literal (numbers / literal vec3s — baked into the shader, the
 * default for every registry component) or node-driven (uniforms), in which
 * case the GPU re-mixes live and only the stop COUNT remains structural.
 */
export function colorRamp(
  t: TSLNode,
  stops: ColorRampStop[],
  colorSpace: ColorSpace = 'linear',
  hueInterpolation: HueInterpolation = 'shorter',
): ShaderNodeObject<Node> {
  const space = colorSpaces[colorSpace];
  const hue = hueArcInterpolators[hueInterpolation];
  const first = stops[0];

  if (first === undefined) return vec3(0, 0, 0);

  const firstCoords = space.fromLinear(vec3(first.color));

  if (stops.length === 1) return space.toLinear(firstCoords);

  // Build a chain of nested mixes, one per adjacent pair of stops, working in
  // the interpolation space. The running result collapses to the previous stop
  // exactly at each segment boundary, so this stays clean pairwise interpolation
  // (and per-segment shortest-arc hue stays correct for cylindrical spaces).
  let resultCoords = firstCoords;

  for (let i = 1; i < stops.length; i += 1) {
    const previousStop = stops[i - 1];
    const next = stops[i];

    if (previousStop === undefined || next === undefined) continue;

    const previousPosition = previousStop.position;
    const nextPosition = next.position;
    let localT: TSLNode;

    if (typeof previousPosition === 'number' && typeof nextPosition === 'number') {
      // Both positions are build-time literals: keep the original math, so
      // every existing baked-ramp caller compiles the identical shader.
      const positionSpan = nextPosition - previousPosition;

      if (positionSpan <= 0) continue;
      localT = clamp(div(sub(t, previousPosition), positionSpan), 0, 1);
    } else {
      // A node-driven position: the span is only known on the GPU, so it
      // can't be inspected (or skipped) at build time. Positive spans get
      // ordinary localize-and-clamp; the floor only keeps that divide
      // finite when stops coincide or cross, where the select discards it
      // for a true hard step at the previous position — t below it holds
      // the earlier stop, t at or above it takes the next (step() is 1
      // when its second argument reaches the edge).
      const span = sub(nextPosition, previousPosition);
      const blended = clamp(div(sub(t, previousPosition), max(span, 1e-4)), 0, 1);

      localT = select(greaterThan(span, 0), blended, step(previousPosition, t));
    }

    const nextCoords = space.fromLinear(vec3(next.color));

    resultCoords = space.lerp(resultCoords, nextCoords, localT, hue);
  }

  return space.toLinear(resultCoords);
}
