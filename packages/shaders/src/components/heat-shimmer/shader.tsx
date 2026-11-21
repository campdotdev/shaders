'use client';

// The heat shimmer's GPU half: a base-pass UV warp that moves where the
// image beneath is sampled, by a small shift that two noise reads give each
// pixel, one for each direction. It adds no light and no color of its own.
// The wrapper (./heat-shimmer.tsx) supplies the props. In this phase the
// shimmer has no clock, so the shift holds still.
import { clamp, max, vec2, vec3 } from 'three/tsl';

import { simplexNoise } from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useBasePassUv } from '../../react/hooks/use-base-pass-uv/use-base-pass-uv.js';

// ---------------------------------------------
// Feel constants (provisional until the defaults gate)
// ---------------------------------------------
// The tuning prop overrides the ones HeatShimmerTuning lists, on the docs
// page, and the defaults gate bakes the landed values back in here.

/**
 * The shimmer's largest reach at a `scale` of 1, in canvas heights per unit
 * of noise. `strength={1}` reaches exactly this far, divided by `scale`. Past
 * some value the shift changes faster across the canvas than the pixels it
 * moves, so neighboring pixels swap places and the image folds over itself.
 * The tuning rig finds that value by raising this at `strength={1}` until
 * the image tears, then backing off. Higher pushes harder, lower is fainter.
 */
const FOLD_LIMIT = 0.25;

/**
 * How much wider than tall each lump of shift is. 1 leaves them round, and
 * 2 makes them twice as wide as tall. Higher stretches the lumps further
 * across, and lower than 1 makes them taller than wide.
 */
const STRETCH = 1.5;

/**
 * Where the second noise read sits on the noise's third axis, in noise
 * units. The noise is smooth over about one unit, so a slice this far away
 * gives values with no tie to the first read's, and the sideways and the
 * vertical shift don't move in step. Any distance of a few units works.
 */
const SECOND_SLICE = 37.5;

/**
 * The smallest `scale` the shader accepts. The reach divides by `scale`,
 * so 0 would divide by zero. At 0.1 a lump is ten canvas heights across.
 * Lower lets a `scale` near 0 grow the reach without bound, and higher
 * stops `scale` from making the lumps larger.
 */
const MIN_SCALE = 0.1;

/** TEMPORARY (build-phase tuning only): dev overrides for the feel constants. */
export interface HeatShimmerTuning {
  /** The shimmer's largest reach at a `scale` of 1, in canvas heights per unit of noise. */
  foldLimit?: number;
  /** How much wider than tall each lump is. 1 is round. */
  stretch?: number;
}

/**
 * TEMPORARY (build-phase tuning only): the tuning overrides, each in a
 * uniform so the tuning sliders glide without rebuilding the shader. The
 * defaults gate deletes this hook and bakes the constants back in.
 */
function useTuningUniforms(tuning: HeatShimmerTuning | undefined) {
  const { foldLimit = FOLD_LIMIT, stretch = STRETCH } = tuning ?? {};

  return {
    foldLimitUniform: useAnimatableUniform<number>(foldLimit),
    stretchUniform: useAnimatableUniform<number>(stretch),
  };
}

export interface HeatShimmerShaderProps {
  /**
   * How hard the shimmer pushes, from 0 to 1, where 1 is the most that
   * can't fold the image and 0 leaves it unchanged. Values outside 0 to 1
   * clamp. Accepts a static value or an animation signal.
   */
  strength: AnimatableProp<number>;
  /**
   * How many lumps of shift fit in the canvas's height. Higher is more and
   * smaller. Accepts a static value or an animation signal.
   */
  scale: AnimatableProp<number>;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants.
   */
  tuning: HeatShimmerTuning | undefined;
}

export function HeatShimmerShader({ strength, scale, tuning }: HeatShimmerShaderProps) {
  // The dials live in uniforms, values the CPU writes and the GPU reads at
  // each draw, so changing them never rebuilds the output chain.
  const strengthUniform = useAnimatableUniform<number>(strength);
  const scaleUniform = useAnimatableUniform<number>(scale);
  const aspectUniform = useAspectUniform();
  const { foldLimitUniform, stretchUniform } = useTuningUniforms(tuning);

  // ---------------------------------------------
  // The warp: move where the image beneath is sampled
  // ---------------------------------------------
  // A base-pass UV warp: the callback receives the 0..1 coordinate the
  // image beneath is about to be sampled at and returns a replacement. The
  // pixel keeps its place on screen and shows the image from a little way
  // off, so an edge under a shift looks bent. `coordinate` is a pass
  // coordinate, [0, 0] at the top-left with y growing downward.
  useBasePassUv(
    (coordinate) => {
      // Where this pixel reads the noise. y is already in canvas heights.
      // x runs over the canvas width, so multiplying it by the aspect puts
      // it in canvas heights too, which keeps the lumps the same shape on a
      // wide canvas and a tall one (aspect correction). Dividing x by the
      // stretch slows the noise across, so each lump spans more of the
      // width than the height. `scale` then fits that many lumps in the
      // canvas's height. The floor keeps it off 0 for the reach below.
      const safeScale = max(scaleUniform, MIN_SCALE);
      const noisePoint = vec2(
        coordinate.x.mul(aspectUniform).div(stretchUniform),
        coordinate.y,
      ).mul(safeScale);

      // Two noise reads, each a smooth random number from about -1 to 1
      // that changes gradually across the canvas. The first sets the
      // sideways shift and the second, one slice further along the noise's
      // third axis, the vertical one. Two independent reads move an edge at
      // every angle: a vertical edge such as a stem bends sideways, and a
      // horizontal one bends up and down. The third axis holds 0 for now,
      // and a later phase moves both slices along it with a clock.
      const shiftAcross = simplexNoise(vec3(noisePoint, 0));
      const shiftDown = simplexNoise(vec3(noisePoint, SECOND_SLICE));

      // The reach: how far a noise value of 1 moves the sample, in canvas
      // heights. `strength` clamps to 0..1, so 1 is the fold limit's reach
      // and 0 leaves the image exactly as it was. Dividing by `scale` keeps
      // the shift's steepness the same as the lumps change size. Smaller
      // lumps change faster across the canvas, so the same reach on them
      // would fold the image sooner. Steepness, not reach, is what folds:
      // once the shift falls by more than a pixel over one pixel's step,
      // the next pixel reads from behind this one.
      const reach = clamp(strengthUniform, 0, 1).mul(foldLimitUniform).div(safeScale);

      // Back to the pass's units. The vertical shift is already a share of
      // the canvas's height. The sideways one is in canvas heights, so
      // dividing it by the aspect turns it into a share of the width, the
      // same distance on screen as the vertical one.
      const shift = vec2(shiftAcross.div(aspectUniform), shiftDown).mul(reach);

      return coordinate.add(shift);
    },
    [strengthUniform, scaleUniform, aspectUniform, foldLimitUniform, stretchUniform],
  );

  return null;
}
