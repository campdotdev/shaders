import { length, sin, smoothstep, sub } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';
import { elapsedTime } from '../time/time.js';

export interface CursorRippleOptions {
  /** Decay radius (UV space). Beyond this, the ripple is ~0. Default: 0.4. */
  reach?: number;
  /** Wavelength controls the ripple spacing. Default: 30. Larger = wider rings. */
  frequency?: number;
  /** Time multiplier on the wave phase. Default: 6. Larger = faster oscillation. */
  speed?: number;
  /** Output amplitude. Default: 0.5. Final result is in roughly [-amplitude, +amplitude]. */
  amplitude?: number;
}

/**
 * A radial ripple emanating from `center`. Returns a scalar TSL node in
 * roughly [-amplitude, +amplitude] that decays to ~0 outside `reach`.
 *
 *   ripple = sin(d*frequency - time*speed) * amplitude * smoothstep(reach, 0, d)
 *
 * Compose into a wave field by adding it to the underlying base wave.
 *
 * Note: `frequency` / `speed` / `reach` / `amplitude` are JS-side numbers
 * (baked into the TSL fragment at material-build time). The animatable
 * cursor position is the only live uniform consumed.
 *
 * @param p — Vec2 TSL node (typically `uv()`).
 * @param center — Vec2 TSL node (cursor uniform, in UV space).
 */
export function cursorRipple(
  p: TSLNode,
  center: TSLNode,
  opts: CursorRippleOptions = {},
): ShaderNodeObject<Node> {
  const reach = opts.reach ?? 0.4;
  const frequency = opts.frequency ?? 30;
  const speed = opts.speed ?? 6;
  const amplitude = opts.amplitude ?? 0.5;

  // d = length(p - center). Use functional `sub(p, center)` because both
  // are typed as the broad TSLNode union (no chain receiver). Chaining off a
  // raw vec `uniform()` receiver silently produces wrong GPU values (see the
  // AGENTS.md gotcha), so the functional form is also safer for `center`
  // being a uniform.
  const d = length(sub(p, center));
  // `time` is the engine-gated TSL node (from primitives/time/time.ts);
  // chains rooted in `time` automatically respect `prefers-reduced-motion` and
  // the runtime override set via `setReducedMotionPolicy`.
  const wave = sin(d.mul(frequency).sub(elapsedTime.mul(speed)));
  const decay = smoothstep(reach, 0, d);

  return wave.mul(amplitude).mul(decay);
}
