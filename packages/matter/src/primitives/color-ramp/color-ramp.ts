import type { ShaderNodeObject } from 'three/tsl';
import { clamp, div, sub, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { hueArcInterpolators } from '../color-space/hue.js';
import { colorSpaces } from '../color-space/registry.js';
import type { ColorSpace, HueInterpolation } from '../color-space/types.js';

/**
 * Canonical TSL-node *input* shape used throughout `@lovo/matter`.
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
  /** Color expressed as a TSL node (typically `vec3(r,g,b)`), in linear-sRGB. */
  color: TSLNode;
  /** Position 0..1 along the ramp. */
  position: number;
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
    const positionSpan = next.position - previousStop.position;

    if (positionSpan <= 0) continue;
    // Localize t into the [prev..next] range. `t` is TSLNode (the union),
    // so we use functional-form ops to avoid needing a chain-method receiver.
    const localT = clamp(div(sub(t, previousStop.position), positionSpan), 0, 1);

    const nextCoords = space.fromLinear(vec3(next.color));

    resultCoords = space.lerp(resultCoords, nextCoords, localT, hue);
  }

  return space.toLinear(resultCoords);
}
