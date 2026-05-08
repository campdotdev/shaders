import { sin, length, smoothstep } from 'three/tsl'
import { time } from './tsl-reexports.js'
import type { TSLNode } from './colorRamp.js'
import type { ShaderNodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export interface CursorRippleOptions {
  /** Decay radius (UV space). Beyond this, the ripple is ~0. Default: 0.4. */
  reach?: number
  /** Wavelength controls the ripple spacing. Default: 30. Larger = wider rings. */
  frequency?: number
  /** Time multiplier on the wave phase. Default: 6. Larger = faster oscillation. */
  speed?: number
  /** Output amplitude. Default: 0.5. Final result is in roughly [-amplitude, +amplitude]. */
  amplitude?: number
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
): TSLNode {
  const reach = opts.reach ?? 0.4
  const frequency = opts.frequency ?? 30
  const speed = opts.speed ?? 6
  const amplitude = opts.amplitude ?? 0.5

  // d = length(p - center). Build the chain rooted in `p` (uv()-derived) and
  // pass `center` (a uniform in real callers) as the SUBTRACTION ARGUMENT —
  // never as the receiver. Per gotcha #12, chaining `.sub(...).mul(...)` off
  // a raw `uniform()` receiver silently produces wrong GPU values.
  const d = length(
    (p as ShaderNodeObject<Node>).sub(center as ShaderNodeObject<Node>),
  ) as ShaderNodeObject<Node>
  // `time` is the engine-gated TSL node (re-exported from tsl-reexports.ts);
  // chains rooted in `time` automatically respect `prefers-reduced-motion` and
  // the runtime override set via `setReducedMotionPolicy`.
  const wave = sin(d.mul(frequency).sub(time.mul(speed))) as ShaderNodeObject<Node>
  const decay = smoothstep(reach, 0, d as never) as ShaderNodeObject<Node>
  return wave.mul(amplitude).mul(decay)
}
