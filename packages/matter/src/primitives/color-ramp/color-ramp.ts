import type { ShaderNodeObject } from 'three/tsl';
import { mix, vec3 } from 'three/tsl';
import { clamp, div, sub } from 'three/tsl';
import type { Node } from 'three/webgpu';

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
  /** Color expressed as a TSL node (typically `vec3(r,g,b)`). */
  color: TSLNode;
  /** Position 0..1 along the ramp. */
  position: number;
}

/**
 * Multi-stop color interpolation. Given a t in [0..1] and N color stops at
 * fixed positions, returns the smoothly-interpolated color.
 *
 * Falls back to the first/last stop's color outside the bracketing positions.
 */
export function colorRamp(t: TSLNode, stops: ColorRampStop[]): ShaderNodeObject<Node> {
  // TSLNode is wider than ShaderNodeObject<Node> in TSL's published types
  // (see CLAUDE.md gotcha #5). Wrapping with mix(node, node, 0) yields a
  // chainable ShaderNodeObject<Node> without a cast — the GPU shader compiler
  // folds the no-op interpolation away.
  const first = stops[0];

  if (first === undefined) return vec3(0, 0, 0);
  if (stops.length === 1) return mix(first.color, first.color, 0);

  // Build a chain of nested mixes, one per adjacent pair of stops.
  // For three stops at positions 0, 0.5, 1:
  //   inner = mix(stop0, stop1, smoothstep(0, 0.5, t))
  //   outer = mix(inner, stop2, smoothstep(0.5, 1, t))
  let result = mix(first.color, first.color, 0);

  for (let i = 1; i < stops.length; i += 1) {
    const previousStop = stops[i - 1];
    const next = stops[i];

    if (previousStop === undefined || next === undefined) continue;
    const positionSpan = next.position - previousStop.position;

    if (positionSpan <= 0) continue;
    // Localize t into the [prev..next] range. `t` is TSLNode (the union),
    // so we use functional-form ops to avoid needing a chain-method receiver.
    const localT = clamp(div(sub(t, previousStop.position), positionSpan), 0, 1);

    result = mix(result, next.color, localT);
  }

  return result;
}
