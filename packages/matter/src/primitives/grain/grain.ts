import { float, hash, screenCoordinate } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../color-ramp/color-ramp.js';

type TSLScalar = TSLNode | number;

export function grain(intensity: TSLScalar, timeOffset: TSLScalar = 0): ShaderNodeObject<Node> {
  const pixel = screenCoordinate.xy.floor();
  // Convert to uint up front so all seed arithmetic stays in exact integer
  // space — float32 loses integer precision above 2^24 (~16.7M), which a
  // pixel-index seed on a 4K+ screen can reach.
  const column = pixel.x.toUint();
  const row = pixel.y.toUint();

  // Build the seed by NESTING hashes rather than summing a single linear term.
  // A single linear seed (a*x + b*y + c*t) makes the grain a 1-D function with
  // a fixed gradient axis (a, b): advancing t shifts that function along the
  // axis, and even folding t in by XOR leaves a partial pseudo-shift along it —
  // both read as grain "drifting" in one direction. Nesting scrambles each axis
  // before they meet, so there is no shared gradient axis: every frame is an
  // independent, isotropic field that boils in place with no directional drift.
  const frameHash = hash(float(timeOffset)).mul(0xffffff).toUint();
  const rowHash = hash(row.add(frameHash)).mul(0xffffff).toUint();
  const seed = column.add(rowHash);

  return hash(seed).sub(0.5).mul(intensity);
}
