// The probe's swirl: a slow flow, in the spirit of LiquidGradient's, that
// carries the marble's veins around eddies. Each pixel traces its point
// backward along the flow and reads the marble once, where the trace ends,
// so the cost is a few noise reads per step, not a marble per step. The flow
// reads Blender's own Perlin noise (nodes/noise.ts).
import { float, Fn, Loop, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { TSLNode } from './nodes/gpu-function';
import { snoise3 } from './nodes/noise';

// Steps in the backward trace. Each step reads the noise three times, so
// more steps follow tight eddies more faithfully and cost more. Fewer than
// about 4 cut across curves and the swirl turns into a lumpy shove.
const STEPS = 6;

// The finite-difference step, in noise units, for the noise's slope. Small
// next to the noise's lattice cell of 1, so the difference stays close to
// the true slope, and large enough that float rounding doesn't swamp it.
const SLOPE_STEP = 0.01;

// Moves the flow's noise away from the marble's, which reads the same Perlin
// lattice, so eddies don't line up with veins.
const FLOW_OFFSET = [37.13, 71.29] as const;

// Each input is any float node, such as a slider's uniform.
export interface SwirlInputs {
  /** How far each point travels back along the flow, in object units. */
  amount: Node;
  /** Eddies per object unit. The plane spans 2 units. */
  eddiesPerUnit: Node;
  /** How far the flow has evolved. Its eddies morph as this grows. */
  time: Node;
}

/**
 * Trace `point` (a vec2 in object space) backward along the flow and return
 * where it lands. With amount 0 the point stays put.
 *
 * The flow is the curl of a noise field: the noise's slope turned 90
 * degrees, (dn/dy, -dn/dx). That runs along the noise's contour lines, so it
 * circles the hills and valleys and never piles color into a sink. The slope
 * is taken in the noise's own units, which keeps the speed the same at any
 * eddy size: smaller eddies are tighter, not faster.
 */
export function swirl(point: TSLNode, { amount, eddiesPerUnit, time }: SwirlInputs): TSLNode {
  return Fn(() => {
    // Pinned before the loop, so the loop doesn't redo them every step (the
    // first-use gotcha in docs/agents/tsl.md).
    const traced = vec2(point).toVar();
    const stepLength = float(amount).div(STEPS).toVar();
    const frequency = float(eddiesPerUnit).toVar();
    const depth = float(time).toVar();

    Loop(STEPS, () => {
      const noisePoint = traced
        .mul(frequency)
        .add(vec2(...FLOW_OFFSET))
        .toVar();
      const here = snoise3(vec3(noisePoint, depth));
      const right = snoise3(vec3(noisePoint.add(vec2(SLOPE_STEP, 0)), depth));
      const up = snoise3(vec3(noisePoint.add(vec2(0, SLOPE_STEP)), depth));
      const velocity = vec2(up.sub(here), here.sub(right)).div(SLOPE_STEP);

      traced.subAssign(velocity.mul(stepLength));
    });

    return traced;
  })();
}
